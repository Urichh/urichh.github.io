---
title: "Introducing Factorio Map Preview Generator (Public Beta)"
date: 2026-06-26
categories:
tags: factorio map preview generator
layout: single
author_profile: true
---

# Intro

Early this year, I got addicted to [Factorio](https://factorio.com/) (as one does) for a couple of months, and while the game is great, I sometimes found it frustrating trying to find certain ore patches on the map without either wasting hours exploring the map, or using console commands to reveal the entire map, thus ruining the exploration part of the experience alongside also disabling achievements for that save.

Of course, the easiest solution to this would be to simply start a new world with the same seed and map generation parameters as my current game, reveal the map, find the desired ore patch (in my case I was looking for oil), and then return to my original non-altered save. This process takes about 10 minutes, but instead of doing that, I instead opted to spend dozens of hours creating an online tool to generate factorio map previews.

<figure style="text-align:center">
    <img src="https://imgs.xkcd.com/comics/automation.png" alt="Relevant xkcd" title="Relevant xkcd" style="display:block;margin:0 auto;height:25em;width:25em"/>
    <figcaption style="display:block;text-align:center;clear:both;width:25em;margin:0.5em auto 0"><a href="https://xkcd.com/1319/">Relevant xkcd (as always)</a></figcaption>
</figure>

## The website

So before I dive into this entire project, you should know that the website is already public as you are reading this. You may visit it at [www.factoriopreview.com](https://www.factoriopreview.com/) and give it a try :)

<figure style="text-align:center">
    <img src="{{ site.baseurl }}/assets/images/fmpg_website_screenshot.png" alt="Website screenshot" title="Website screenshot" style="display:block;margin:0 auto;height:35em;width:35em"/>
    <figcaption style="display:block;text-align:center;clear:both;width:25em;margin:0.5em auto 0">Website screenshot</figcaption>
</figure>

Essentially, The website allows users to generate map previews based on a number of input parameters. The preview is then also analyzed for extra information, but that functionallity is currently quite limited. More info on that later.

# Initial idea and end goal

If we rewind the clock back a few months to when I first started looking into factorios built-in map preview image generator documentation, I quickly learned that it supported generating previews by running the factorio executable with some command line arguments, which would produce png file of the map preview.

The basic syntax (on windows) was simply:

```
.\factorio.exe --generate-map-preview <output_image>.png --map-gen-settings <settings>.json --map-gen-seed <seed_integer> --map-preview-size <dimensions_integer>
```

This was already great, as it launched factorio in headless (CLI) mode and thus produced a preview png relatively quickly (cca. 5 - 45 seconds depending on various generation parameters) without using many resources, but one notable issue was that in order to get the exact same preview as the world I had created, simply supplying the same pseudo-random generation seed wasn't enough, I also had to supply dozens of other map generation settings, such as, among many others, specific ore frequency, scale of forests and oceans, cliffs, rock coverage etc.

All these parameters then had to be written to a json file with a specific structure, so that the executable/binary would be able to correctly parse and interpret the data for the generation process.

<figure style="text-align:center">
    <img src="{{ site.baseurl }}/assets/images/gp-420.png" alt="example map preview" title="example map preview" style="display:block;margin:0 auto;height:25em;width:25em"/>
    <figcaption style="display:block;text-align:center;clear:both;width:25em;margin:0.5em auto 0">Example of a map preview png</figcaption>
</figure>

## high-level overview:

All of this led me to the idea for the website. If I could simply re-create the in-game map generation settings menu and reverse engineer the logic which creates the settings json file, I could then automate the entire process of generating image previews from a simple website. This sounded like a cool project (and I was looking for something new to replace my factorio addiction), so I decided to also over-complicate this project in the name of scalability :)

The idea was simple:
 - users inputs map generation parameters,
 - website constructs a settings json object,
 - website sends the json object and other files to a backend worker server,
 - worker runs the factorio binary with specified command line arguments and generates a png,
 - worker sends png back to frontend website, which then presents it back to the user.

Of course, it would turn out more complex than this, partially due to unforseen challanges but also my own tendency to overcomplicate, but this was the general idea getting into it.

# Image analysis

Before I go too far into the rest of this post, I'd like to briefly describe the preview image analyzer, as I wasn't sure where to best place this section inside this blog post.

The preview analyzer is a python script, that runs "over" the generated PNG in order to extract certain information from it. Currently, that information is limited to ore patches, which the preview analyzer stores in the form of vertecies in a JSON file, and the website then interprets those vertecies into overlays over the generated PNG.

<figure style="text-align:center">
    <img src="{{ site.baseurl }}/assets/images/preview_side_by_side.png" alt="Before and after preview analysis" title="Before and after preview analysis" style="display:block;margin:0 auto;height:15em;width:30em"/>
    <figcaption style="display:block;text-align:center;clear:both;width:25em;margin:0.5em auto 0">Before and after preview analysis</figcaption>
</figure>
