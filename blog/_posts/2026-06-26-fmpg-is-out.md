---
title: "Introducing Factorio Map Preview Generator (Public Beta)"
date: 2026-06-26
categories:
tags: factorio map preview generator
layout: single
author_profile: true
---

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

Essentially, The website allows users to generate map previews based on a number of input parameters. The preview is then also analyzed for extra information, but that functionality is currently quite limited. More info on that later.

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

Of course, it would turn out more complex than this, partially due to unforeseen challenges but also my own tendency to overcomplicate, but this was the general idea getting into it.

# Image analysis

Before I go too far into the rest of this post, I'd like to briefly describe the preview image analyzer, as I wasn't sure where to best place this section inside this blog post.

The preview analyzer is a python script, that runs "over" the generated PNG in order to extract certain information from it. Currently, that information is limited to ore patches, which the preview analyzer stores in the form of vertices in a JSON file, and the website then interprets those vertices into overlays over the generated PNG.

<figure style="text-align:center">
    <img src="{{ site.baseurl }}/assets/images/preview_side_by_side.png" alt="Before and after preview analysis" title="Before and after preview analysis" style="display:block;margin:0 auto;height:15em;width:30em"/>
    <figcaption style="display:block;text-align:center;clear:both;width:25em;margin:0.5em auto 0">Before and after preview analysis</figcaption>
</figure>

As you can see, this current functionality is a little useless, but It's here as a jumping-off point for future endeavors. My eventual goal is to calculate expected resources for ore patches, which I could then use to generate desirable preview *en masse*.

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

Once the mask is clean enough, the script finds connected regions in it. Each connected region becomes a candidate ore patch, and anything smaller than the minimum area threshold is ignored. For each valid connected component, the analyzer traces its contour and simplifies it into a polygon. If the contour is too simple to produce a useful polygon, it falls back to a bounding box rectangle, but that should only really happen if the user deliberately chooses very small ore patch sizes in the input parameters.

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

## Brief overview of components

### Frontend
The frontend was created using next.js and typescript etc. It just accepts user input and displays the generated image. I do have to admit that I find frontend development quite boring, so 90% of frontend code was LLM generated :)

### API plane

The API plane is the projects backend orchestration layer. It sits between the React frontend and the worker/storage stack, turning UI form state into Factorio map-generation JSON object(s), hashing it into a dedupe key, and then using that to create or reuse jobs in Postgres and enqueue new work on Redis. From there, the UI polls a job-status endpoint that returns the job row plus artifact links, while a separate artifact proxy streams the generated PNG/JSON back from the storage.

### SQL database(s)

The SQL side of this project is pretty minimal, as it uses a single Postgres database with two tables. The first one (titled "jobs") stores preview requests, the dedupe key, seed, full map-generation JSON, job status etc. The second table (called "artifacts") is a child table that points from a job to generated files in blob storage, so each job can point to its preview PNG and JSON (more details later). The API endpoints mainly write to jobs when a request is submitted, reads jobs plus artifacts when the UI polls for status, and relies on the dedupe key to avoid creating duplicate work for identical inputs.

### Redis queue

The Redis queue is the projects job queue. The web app enqueues each new preview request into a Redis stream and then the workers join that stream through a consumer group to claim jobs one at a time. The worker then looks up the job in Postgres to retrieve status and other parameters, runs Factorio plus the analyzer, stores artifacts, updates job status, and finally XACKs the stream message so it won’t be processed again. if a message is malformed or the job row is missing, it still gets acknowledged and skipped.

### Docker worker pool

The Docker worker pool is a deliberately simple horizontal layer. One identical container image built from a Dockerfile is launched repeatedly (compose scaling) by docker-compose.worker.yml, and each instance runs the same Python worker against the same Redis stream, Postgres database, and Garage bucket. The compose file keeps the container stateless by injecting all runtime config from .env and mounting only the analyzer, Factorio files, and a shared data volume, so scaling is basically just increasing the number of worker replicas.

### Preview generator

Not much to be said here. Mostly already described previously. The factorio binary is just ran with the supplied parameters taken from the db.

### Image analyzer

Same here.

### Blob storage

Finally, the blob storage layer is implemented using [Garage](https://garagehq.deuxfleurs.fr/), which is the projects S3-compatible object store for generated outputs like the preview PNG and analyzer JSONs. I really had no reason to use object storage instead of a classic file system or yet another SQL db, but I really wanted to test this whole s3/object storage thing out, so thats what I did :). The workers upload finished artifacts into the factorio-previews bucket, and then write the resulting object_key back into Postgres so the app can find them later without storing the files in the database. When the UI needs an artifact, it goes through the apps /api/artifacts/... proxy, which fetches the object from Garage and serves it back on the same origin.

# Job lifecycle

For this chapter, I think it would be best if I describe the job lifecycle so that I can present how all these previously described components fit into the whole project.

### 1. Client submits seed and settings to the `/map-settings` API endpoint.
Client just reads data from the generation parameters panel and others, and sends the data over to the API endpoint. Pretty self-explanatory.

### 2. The API endpoint computes a deterministic cache key
This key, called a "`dedupe_key`", is used to check whether this is a duplicate request so that it may skip generation steps and immediately return the result to the client. The dedupe key is constructed as following:

```
function buildDedupeKey(settings: unknown, seed: number, width: number, height: number) {
  const canonicalSettings = canonicalize(settings);
  const payload = {
    analyzerVersion: ANALYZER_VERSION,
    canonicalSettings,
    factorioVersion: FACTORIO_VERSION,
    previewHeight: height,
    previewWidth: width,
    seed,
  };
  //needed for dedupe_key to detect identical requests
  return createHash("sha256").update(canonicalStringify(payload)).digest("hex");
}
```

Here, values `analyzerVersion` and `factorioVersion` are hardcoded values indicating my analyzer (python script) and game version. thus, if I make an adjustment to the analyzer, seemingly identical requests will be re-processed.

`canonicalSettings` is stringified canonicalized JSON structure of the data inputted in the Generation parameters panel. The structure of the JSON object should be consistent due to the logic which constructs the JSON object from the generation parameters panel, but canonicalising it serves to future-proof the process as well as harden it overall.

Lastly, `previewHeight`, `previewWidth` and `seed` are somewhat redundant, as this data is also present inside the `canonicalSettings` object, but I decided to keep them separate in the request and the database for ease of access. Might be useful in the future. Or not, idk :)

### 3. API checks and pushes to database

As described above, the API checks if there is a row in the jobs db with an identical `dedupe_key`. If yes, it skips most of the lifecycle, otherwise it creates a "job" record in the db with its status as "queued" (explained later).

### 4. API pushes a message to queue (redis)

Since the workers do not consume jobs directly from the database, but instead from the previously described redis queue, the API also enqueues a small redis message containing the `job_id` and `dedupe_key`:

```
async function enqueueJob(jobId: string, dedupeKey: string) {
  const redisClient = await getRedisClient();
  const streamName = process.env.REDIS_STREAM_NAME ?? "fmpg:jobs";

  console.log("jobs route: enqueueing redis message", { streamName, jobId, dedupeKey });

  return redisClient.xAdd(streamName, "*", {
    job_id: jobId,
    dedupe_key: dedupeKey,
  });
}
```

### 5. First available worker consumes job

As mentioned previously, multiple workers run simultaneously to ensure parallel processing. If a worker is not currently executing a job, it is simply idling and periodically polling the redis queue (every second) for any available job. This is done as such:

```
while True:
    assert self.redis_client is not None
    messages = self.redis_client.xreadgroup(
        groupname=self.config.redis_consumer_group,
        consumername=self.config.redis_consumer_name,
        streams={self.config.redis_stream_name: ">"},
        count=1,
        block=self.config.job_poll_interval_seconds * 1000,
    )
```

I'm going to get into the details of this later, but the gist of it is that it polls the `fmpg` consumer group for any available jobs, and once it receives a job, due to the structure of redis, that job will not be consumed by other workers anymore as to avoid a race condition or simply multiple workers handling the same workload.

### 6. Worker marks DB status running and starts heartbeat updates

After some initial sanity checks (such as if the job_id even exists etc.), the worker looks up the relevant row in the `jobs` db and changes its status from "queued" to "running".

### 7. Worker runs factorio binary, generates png and runs analyzer

This step is pretty simple. Each worker actually gets its own copy of the binary to avoid file locking issues, and runs it. The saved image follows the naming convention of `gp-{dedupe_key}.png` (where "gp" stands for "generated preview") as this allows for easy blob storage lookup later. Afterwards, the worker also runs the preview analyzer over the generated png and saves the output file as `pd-{dedupe_key}.json` ("pd" as in "preview data").

### 8. Worker uploads png/json to object storage

After generation and analysis is complete, the worker uploads the generated files to blob storage. As blob storage is effectively a flat structure, the naming convention discussed before becomes necessary to provide some sort of deterministic file lookup.

### 9. Worker updates DB status completed with artifact paths

After these artifacts are uploaded to object storage, the worker writes the filenames to the `"artifacts"` table in the database, which is connected to the `"jobs"` table on `job_id`. This table simply holds `job_id` as key, `artifact_type` which is either metadata or generated png and finally `object_key`, which is the filename itself. If my math is correct, each entry in the `jobs` database should have 2 corresponding `artifacts` entries (json and png).

### 10. Worker ACKs on redis queue

Pretty simple. After all is done (or in case of failure), the worker then sends an `XACK` to the redis queue for the message, so that the entry is removed from the queue for good.

### 11. Client polls API for result

This is the final step. The client (or rather, client-side javascript) starts polling the `/jobs` API endpoint until it either times out, or the endpoint presents an result to the client. This would have been implemented much more cleanly would I have used a websocket or something, which would allow me to also transmit job status back to the client in real time, but thats a project for later :)

# VMs and hosting in general

Before I go into the previously mentioned components, I would like to briefly mention the entire hosting setup. This entire project is hosted on 5 different VMs on my home cluster (writeup about that coming in the future :)). Briefly explained, I recently got my hands on a pair of [IBM System x3550 M4](https://pubs.lenovo.com/x3550-m4/) servers, which host my proxmox homelab. On the cluster, I then set up 5 different VMs, some of which are specific to this project, and some of which are more general.

<figure style="text-align:center">
    <img src="{{ site.baseurl }}/assets/images/proxmox_vms_screenshot.png" alt="VMs inside proxmox" title="VMs inside proxmox" style="display:block;margin:0 auto;height:20em;width:20em"/>
    <figcaption style="display:block;text-align:center;clear:both;width:25em;margin:0.5em auto 0">VMs inside proxmox</figcaption>
</figure>

Pretty much all the VMs (with some exceptions) are running debian 13 (trixie) with only a minimal setup (imported ssh keys, ufw config etc.). Below is a brief descriptions of the VMs used in this project:
 - **<u>GW-GENERAL01</u>**: This is my general purpose web gateway/reverse proxy VM. All http(s) traffic to my router is forwarded to this VM running nginx, which in our case then forwards traffic to the fmpg frontend VM.
 - **<u>FMPGWEB01</u>**: Just the VM running the preview generator frontend.
 - **<u>FMPGWORKER01</u>**: This VM mostly just runs docker engine with all the docker workers
 - **<u>SQLGENERAL01</u>**: A general SQL VM running PostgreSQL. This VM holds the projects database and also the redis queue.
 - **<u>BLOBSTORAGE01</u>**: Finally, this VM is running the projects object storage "database" (if you can call it that).

Realistically, I didn't have to split all these roles across this many VMs, but it seemed like a clean and "professional" approach, and additionally my newly acquired computing power had to be used for something :)

# API structure

This project uses 4 API endpoints, all of which will be briefly described here.

## /api/map-settings (POST)

The `map-settings` endpoint is the first step in the preview generation pipeline. It accepts generation parameters from the frontend and generates a Factorio map generation settings JSON object. This endpoint is purely generative as it just constructs settings based on user input without any database interactions.

When the user POSTs to this endpoint with parameters like seed, map dimensions, resource configurations etc, it performs some input validation and transformation. Values are clamped to safe ranges (as they are in-game), percentages are converted to ratios, and the settings are canonicalized (objects are recursively sorted by key, which comes in handy later when checking for duplicate requests). The endpoint then computes a SHA-256 hash of the canonicalized settings called the dedupeKey, which is then user for deduplication across subsequent requests with identical parameters.

The response returns the fully normalized Factorio map generation settings JSON in the body, with the dedupeKey provided in the `X-Dedupe-Key` response header as shown below:

```
 //builds the raw map-generation settings json object from the current frontend form state.
 //The raw JSON is returned in the response body, while the dedupe_key (hash) is sent in 'X-Dedupe-Key' header.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as MapSettingsRequestBody;

  if (body.seed === undefined || String(body.seed).trim() === "") {
    return NextResponse.json({ error: "Missing seed" }, { status: 400 });
  }

  const settings = buildMapGenSettings(body);
  const dedupeKey = buildDedupeKey(settings, settings.seed, settings.width, settings.height);

  return NextResponse.json(settings, {
    headers: {
      "X-Dedupe-Key": dedupeKey,
    },
  });
}
```

## /api/jobs (POST)

The `jobs` endpoint accepts the map settings generated by the previous endpoint and submits them into the preview generation queue. It's functionally a gateway between the map configuration and job system. Each request must include the rawSettings (the full settings object) and the dedupeKey (from the X-Dedupe-Key header).

This endpoint also implements the previously mentioned deduplication. It first checks if a job with the same dedupeKey already exists in the database. If found, it returns the existing job's ID and metadata without creating a duplicate. If new, it inserts a job row into PostgreSQL and enqueues a message to Redis containing the job ID and dedupeKey. The response indicates whether the job was created or reused via the created flag, and whether it was newly queued via the queued flag.

## /api/jobs/[jobId] (GET)

This "job Status" endpoint enables the frontend to poll for preview generation progress. Given a job ID (formatted as a UUID), it retrieves the job's metadata and all associated artifacts from the database. The endpoint returns the job's current status (queued, processing, complete, or errored), timestamps for when it was requested/started/finished, and a list of generated artifacts with proxy URLs.

Artifacts are stored objects in the previously discussed S3-compatible storage system (Garage), but the endpoint converts their internal object keys into same-origin relative URLs (/api/artifacts/...). This should protect the client from needing storage credentials and prevents CORS issues, but to be honest I don't really know what im doing here. It also provides convenience fields—previewPngUrl, previewJsonUrl, and a ready boolean so the UI knows when both expected artifacts exist.

A particularly elegant detail: the endpoint validates the jobId format before querying via isValidUuid() to reject malformed requests early and protect the database. See src/app/api/jobs/[jobId]/route.ts for the full implementation.

## /api/artifacts/[...objectKey] (GET)

This "artifacts proxy" endpoint retrieves generated preview files (PNG images and JSON data) from the Garage storage and serves them to the browser. It also acts as a credential "bridge" where the browser passes an object key (split into URL segments), the endpoint uses its configured Garage credentials to fetch the file, and returns the file content.

The screenshot below displays the contents returned to the frontend once (or rather "if") polling is successful. The response includes some metadata which may or may not be used in the future, but the meat of it are the `previewPngUrl` and `previewJsonUrl`, which the frontend then uses to fetch the artifacts from object storage.

<figure style="text-align:center">
    <img src="{{ site.baseurl }}/assets/images/response_example.png" alt="Polling response" title="Polling response" style="display:block;margin:0 auto;height:25em;width:40em"/>
    <figcaption style="display:block;text-align:center;clear:both;width:25em;margin:0.5em auto 0">Polling response</figcaption>
</figure>

# Workers

The workers are responsible for consuming jobs from the queue and generating preview images. The entire system is designed to be horizontally scalable, as multiple worker containers can run simultaneously and automatically distribute work via Redis consumer groups.

## Docker Deployment

The worker runs as a containerized Python application defined by a Dockerfile. The image is based on `python:3.12-slim` and includes system dependencies for preview generation: `libgl1` and `libglib2.0-0` (required by OpenCV for image analysis), plus `ca-certificates` and `curl` for pip. Dependencies are specified in `requirements.txt` which the container reads during startup and includes `NumPy`, `OpenCV (headless)`, `Redis`, `psycopg2`, and `boto3` for the S3-compatible storage access.

Each worker also needs its own copy of the factorio binary in order to avoid file locking issues, which is implemented in the `entrypoint.sh` script. The base Factorio binary is baked into the image at `/app/factorio-base/`, and on startup, the entrypoint copies it to `/app/factorio` with a marker file to prevent re-initialization on restart. This per container isolation is essential because the Factorio binary generates temporary files during map preview rendering, and shared access would cause concurrency issues. The script then executes the Python worker.

```
FROM python:3.12-slim

#don't write .pyc files and don't buffer output
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

WORKDIR /app

#install dependencies. ca-certificates & curl needed for pip, libgl1 & libglib2.0-0 needed for previewAnalyzer (openCV)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY previewAnalyzer.py /app/previewAnalyzer.py
COPY worker.py /app/worker.py

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["python", "-u", "worker.py"]
```

## Docker compose config

The docker-compose yml defines the worker service. Some fun facts:
 - **Scaling**: The service has no fixed container_name, which allows `docker-compose up --scale fmpg-worker=N` to spawn multiple instances, each getting a unique name, which is a very simple way of achieving horizontal scaling :)
 - **Volume mounts**: The /srv/fmpg-worker/data directory provides scratch space for temporary files during generation; the Factorio base, analyzer script, and requirements are mounted read-only to prevent accidental modifications.
 - **Healthcheck**: A very basic health check runs every 30s and just checks whether shell is still responding. A more thorough check of dependencies etc is definitely planned.
```
     healthcheck:
      test: ["CMD-SHELL", "python -c \"import sys; sys.exit(0)\""]
      interval: 30s
      timeout: 5s
      retries: 3
```

## Job Processing Pipeline

Each worker runs a main loop that consumes messages from the Redis stream using consumer groups. The `ensure_consumer_group()` method creates the consumer group on first startup. Workers then call `xreadgroup()` to block until a new message arrives or the poll interval expires.

When a job is received, the worker: (1) updates its status to "running" in PostgreSQL, (2) invokes the Factorio binary via subprocess to generate a preview PNG, (3) runs the preview analyzer to extract metadata into JSON, (4) uploads both files to Garage and records artifact rows in PostgreSQL, and (5) marks the job complete.

# SQL

As described previously, the entire fmpg project uses two SQL tables: `jobs` and `artifacts`. Below is a nice little schema I drew up to represent that:

<figure style="text-align:center">
    <img src="{{ site.baseurl }}/assets/images/fmpg_db_shema.png" alt="SQL schema" title="SQL schema" style="display:block;margin:0 auto;height:20em;width:35em"/>
    <figcaption style="display:block;text-align:center;clear:both;width:25em;margin:0.5em auto 0">SQL schema</figcaption>
</figure>

As you can see, the two tables are connected (primary-foreign key) on `job_id`. Each row in the `jobs` table should (currently) have two associated rows in the `artifacts` table, one for the png and one for the json metadata. The reason I chose to split this into two separate tables is also because the artifacts might change in the future, especially with planned expansions to ore predictions.

# Future plans

Here at the end of this blog post, I would like to briefly mentioned some future plans for this project. Overall please keep in mind that my free time and attention span are severely limited so there will be no timeline for any of this :D

First of all, like i've mentioned before, the current state of this project is ultimately a foundation for the eventual use case of generating desirable maps. Currently, I think this project is set up pretty great to facilitate that, but I still have to implement the following:

 - **Calculate estimated resources for each ore patch**. This is probably the most logical next step, but it's not quite as trivial as you may believe. From my current research, ore patch resources is calculated based on the patch size and offset from center of generated map (further out the patch is, the richer it is). But still, I doubt this calculation is that simple, so the best I can do for now is just to hope that it's deterministic (no rng).
 - **Automatically finding desired seeds for a set of criteria**. This is the logical next step in this chain. Once i'm able to calculate expected resources in an ore patch, I should be able to, for example, input desired map properties (e.g. how much uranium in a specific area bordering a body of water etc.) and then generate map previews matching that criteria.
 - **Map exchange strings**. This should be pretty simple. Once the system finds a satisfactory seed and map gen parameters, the user should be able to generate a new world in their game with these settings. Fortunately, the game supports so called [map exchange strings](https://wiki.factorio.com/Map_exchange_string_format), which allow users to format all parameters into a single base64 string and copy it into the game. There actually already exists a relevant github repo which implements this ([factorio-exchange-string-parser](https://github.com/rfvgyhn/factorio-exchange-string-parser)), so I will have to look into that.
 - **Misc stuffs**. I've been informed of quite a few bugs and otherwise quality-of-life problems which shall be addressed some time in the future :)

# Conclusion

Ok, we finally made it to the end. Realistically, I spent quite a few evenings and weekends making this, and some more writing this over-complicated post, but it's been loads of fun :)

Overall, Factorio Map Preview Generator started as a solution to a very specific mini-problem (finding useful resources without ruining exploration or disabling achievements). What began as a simple idea of automating Factorio’s map preview command eventually grew into a "distributed" system involving a frontend, API layer, PostgreSQL, Redis, Docker workers, object storage, and image analysis. It's definitely way more complex than necessary, but building it was loads of fun and thats what really matters.

Any and all feedback is welcome at urban(at)urbansite.si.

Have a good one!