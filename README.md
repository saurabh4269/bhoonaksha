# Bhoonaksha

A citizen map of Indian land.

**[Open the map](https://bhunaksha.vercel.app)**

Google is streets. This is plots. Anyone can open it. There is no login and no district office.

## Why this exists

India already has cadastral GIS. It lives in state Bhu-Naksha portals: a form first, then a survey drawing, then often another site for the Record of Rights. That software is for the office that already knows the khasra.

Bhoonaksha is the other door. The first screen is the land under you. You tap a field. The plot is the object. The rest waits.

We did not rebuild the land-records system. We rebuilt who the map is for.

## How it is not Google Maps

Google will take you to the village. It does not know your field as the state knows it. There is no survey number, no plot boundary, no village as a land record.

This map is of the piece of earth. Cadastral outlines where public data exists. A passport for the plot: number, village, area, DIGIPIN. Measure it. Share a link. That is the job.

## How it is not state Bhu-Naksha

Those sites have the legal record. We do not. They are the office of record.

Their integration of map and RoR still lives inside the state portal: district, tehsil, village, often a login, a different building in every state.

We start from the plot you are standing on, anywhere in the country, one map. When a state publishes the Record of Rights, it should arrive on that same card, in the same place. Not a redirect into Bhulekh. Not a scrape. Not a fake holder.

Until then the slot stays empty. We do not invent an owner.

## What is live

Citizen map at [`/`](https://bhunaksha.vercel.app). Lekhpal desk at [`/lekpal.html`](https://bhunaksha.vercel.app/lekpal.html) for staff GIS on the same land.

Survey outlines from open tiles where they exist: Andhra Pradesh, Tamil Nadu, Kerala, Telangana, Karnataka, Maharashtra, Odisha, Haryana, Madhya Pradesh, Goa, Assam, Jharkhand. Village search uses the public Local Government Directory. Imagery is Esri. Languages are English plus the 22 Eighth Schedule languages.

Holder, khata, ULPIN, FMB, flood, and drone layers are not here. There is no public feed. The map only claims what is live and keyless.

## Run it

Static files. No build step.

```bash
python3 server.py
```

Or open `index.html` behind any static host. Production is Vercel. Translation uses a server-side `SARVAM_API_KEY` on Vercel only. Do not put that key in the frontend.

## Name

The product is **Bhoonaksha**. It is not a Record of Rights, and it is not the NIC Bhu-Naksha portal.
