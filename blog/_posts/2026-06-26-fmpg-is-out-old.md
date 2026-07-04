---
title: "Introducing Factorio Map Preview Generator (Public Beta) - old"
date: 2026-06-26
categories:
tags: factorio map preview generator
layout: single
author_profile: true
---

## Intro

Early this year, I got addicted to [Factorio](https://factorio.com/) (as one does) for a couple of months, and while the game is great, I sometimes found it frustrating trying to find certain ore patches on the map without either wasting hours exploring the map, or using console commands to reveal the entire map, thus ruining the exploration part of the experience alongside also disabling achievements for that save.

Of course, the easiest solution to this would be to simply start a new world with the same seed and map generation parameters as my current game, reveal the map, find the desired ore patch (in my case I was looking for oil), and then return to my original non-altered save. This process takes about 10 minutes, but instead of doing that, I instead opted to spend dozens of hours creating an online tool to generate factorio map previews.

<figure style="text-align:center">
    <img src="https://imgs.xkcd.com/comics/automation.png" alt="Relevant xkcd" title="Relevant xkcd" style="display:block;margin:0 auto;height:25em;width:25em"/>
    <figcaption style="display:block;text-align:center;clear:both;width:25em;margin:0.5em auto 0"><a href="https://xkcd.com/1319/">Relevant xkcd</a></figcaption>
</figure>

## Initial idea

As I started looking into factorios built-in map preview image generator documentation, I quickly learned that it supported generating previews by running the factorio executable with some command line arguments, which would produce png file of the map preview.

The basic syntax (on windows) was simply:

```
.\factorio.exe --generate-map-preview <output_image>.png --map-gen-settings <settings>.json --map-gen-seed <seed_integer> --map-preview-size <dimensions_integer>
```

This was already great, as it launched factorio in headless (CLI) mode and thus produced a preview png relatively quickly (cca. 5 - 45 seconds depending on various generation parameters) without using many resources.

This was already great, but one notable issue was that in order to get the exact same preview as the world I had created, simply supplying the same pseudo-random generation seed wasn't enough, I also had to supply dozens of other map generation settings, such as, among many others, specific ore frequency, scale of forests and oceans, cliffs, rock coverage etc.

All these parameters then had to be written to a json file with a specific structure, so that the executable/binary would be able to correctly parse and interpret the data for the generation process.

<figure style="text-align:center">
    <img src="{{ site.baseurl }}/assets/images/gp-420.png" alt="example map preview" title="example map preview" style="display:block;margin:0 auto;height:25em;width:25em"/>
    <figcaption style="display:block;text-align:center;clear:both;width:25em;margin:0.5em auto 0">Example of a map preview png</figcaption>
</figure>

## The original plan

All of this led me to the idea for the website. If I could simply re-create the in-game map generation settings menu and reverse engineer the logic which creates the settings json file, I could then automate the entire process of generating image previews from a simple website. This sounded like a cool project (and I was looking for something new to replace my factorio addiction), so I decided to also over-complicate this project in the name of scalability :)

The idea was simple:
 - users inputs map generation parameters,
 - website constructs a settings json object,
 - website sends the json object and other files to a backend worker server,
 - worker runs the factorio binary with specified command line arguments and generates a png,
 - worker sends png back to frontend website, which then presents it back to the user.

Of course, it would turn out more complex than this, partially due to unforseen challanges but also my own tendency to overcomplicate, but this was the general idea getting into it.

## Workflow & infrastructure design

Once I had the general user flow defined, it was time to actually think about the design for this project. From the top of my head, I had a couple of potential problems/challanges lined up, which I wanted to address. The challenges were:
 - how will multiple users be able to generate previews simultaneously?
 - how should I implement caching for duplicated requests?
 - how can I properly keep track of generation jobs
 - etc.

# Parallel generation for multiple users

This was the biggest design challange that consequently also dictated much of the design for the rest of the project. If I wanted multiple users to be able to generate previews simultaneously, I somehow had to provide multiple independent workers, each with their own factorio binary, which could run generation jobs, and these workers should also be able to work independetnly of each other without getting in each others way.

The way I decided to achieve this was with dedicated docker workers, all of which would recieve jobs from a central jobs pool/queue. I also wanted to keep track of these jobs, so that multiple workers wouldn't start working on the same job.

In order to achieve this, I decided on a simple FIFO queue, which was to be implemented using [redis](https://redis.io/) as an in-memory data structure. The redis queue came in handy because of it's built-in ability to create consumer groups, where workers could ACK a claimed job from the queue, so that other workers wouldn't claim an already claimed job. This probbably could have also been achieved with a simple SQL database, but I just wanted to see what the fuss is all about with redis :)

# Database & storage overview

While redis would only hold the basic necessary information (mainly the jobID), a central postgreSQL database would be the central source of truth, which would hold the actual status of jobs (enqueued/running/finished/etc.), the generation parameters, seed etc.

And if I wanted to do the whole caching thing, I needed some way to actually store the generated PNGs permanently. I could have just used a regular file system, or even an SQL database, but what would have been too convenient, for me, and I wanter to try out this "blob"/object storage thingy, thus I decided to use [garage](https://garagehq.deuxfleurs.fr/), partially also because it is S3 compactible, and if I ever wanted to lift%&shift my bucket into AWS or some equivalent storage, that would be pretty trivial.

# simplified job lifecycle

So the high-level job lifecycle overview goes like this:

1. Client submits seed/settings to API
2. API checks for duplicate entry (explained later)
3. API creates job record in DB
4. API pushes small redis message to the queue
5. Workers periodically poll queue for available jobs
6. Worker marks DB status running and starts heartbeat updates
7. Worker runs Factorio binary with input parameters
8. Worker runs preview analyzer (explained later)
9. Worker uploads png and json to object storage
10. Worker updates DB status completed with artifact paths
11. Worker acknowledges queue message so it is removed from queue
12. API pulls generated image from object storage and sends it to the client
13. Client displays image overlayed with analyzed data

