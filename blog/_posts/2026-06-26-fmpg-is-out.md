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

As you can see, this current functionallity is a little useless, but It's here as a jumping-off point for future endevours. My eventual goal is to calculate expected resources for ore patches, which I could then use to generate desirable preview *en masse*.

## How it works

The script `previewAnalyzer.py` is built around a simple idea: each resource in the Factorio preview image has a known exact color, and the analyzer looks for those colors pixel by pixel. From there, the image is loaded and converted into RGB so the color matching logic works correctly. The core mask-building step just keeps only the pixels that exactly match a target resource color.

```
def build_color_mask(image_rgb: np.ndarray, target_rgb: tuple[int, int, int]) -> np.ndarray:
    target = np.array(target_rgb, dtype=np.uint8)
    return np.all(image_rgb == target, axis=2).astype(np.uint8)
```

This function just builds a strict binary mask, which can be then used to determine ore patches.

<figure style="text-align:center">
    <img src="{{ site.baseurl }}/assets/images/resource-copper.png" alt="Example binary mask only extracting copper ore patches" title="Example binary mask only extracting copper ore patches" style="display:block;margin:0 auto;height:25em;width:25em"/>
    <figcaption style="display:block;text-align:center;clear:both;width:25em;margin:0.5em auto 0">Example binary mask only extracting copper ore patches</figcaption>
</figure>

After the mask is created, the analyzer cleans it up with morphology operations using [cv2](https://pypi.org/project/opencv-python/) *magic*. This helps remove tiny noise and smooth out small gaps before patch detection, but this is not always useful in "pixel-art" images such as here. This might need some more tweaking in the future.

Once the mask is clean enough, the script finds connected regions in it. Each connected region becomes a candidate ore patch, and anything smaller than the minimum area threshold is ignored. For each valid connected component, the analyzer traces its contour and simplifies it into a polygon. If the contour is too simple to produce a useful polygon, it falls back to a bounding box rectangle, but that should only really happen if the user deliberatly chooses very small ore patch sizes in the input parameters.

That data is then packaged into a "Patch" object, which stores the patch ID, resource type, pixel area, centroid, bounding box, and polygon:

```
Patch(
    id=f"{resource_name}-{patch_index}",
    type=resource_name,
    area_pixels=area,
    centroid=[centroid_x, centroid_y],
    bbox={"x": x, "y": y, "width": width, "height": height},
    polygon=polygon,
)
```

The image analyzer repeats this process for every configured resource color and returns a JSON object of all detected resource patches, which is later sent back to the user.

# High-level architecture

Before diving into specific, I just want to give a brief high-level overview of the architecture.

<figure style="text-align:center">
    <img src="{{ site.baseurl }}/assets/images/high-level_overview.png" alt="High-level overview" title="High-level overview" style="display:block;margin:0 auto;height:35em;width:15em"/>
    <figcaption style="display:block;text-align:center;clear:both;width:25em;margin:0.5em auto 0">High-level overview</figcaption>
</figure>