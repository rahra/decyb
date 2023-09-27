With this tool you can convert your own GPX track into the YB JSON formats
necessary to use this data viewer.
This program is written in Javascript. You need to have 'node' and 'npm'
installed in order to run this. It depends on the module [GpxParser](https://github.com/Luuka/GPXParser.js).
Install it with `npm install --save gpxparser`.

You need your GPX track and a race course in GPX format as well. Even if you
didn't race create a track with any tool which shows the original intended
route of your journey.  * Then modify the file RaceSetup.template.json
according to your needs. Finally start the converter by running the command
`./gpxconv <yourtrack.gpx> <yourracecourse.gpx>`.
Please note that the trackpoints in your file should be in strict ascending
time order.

\author Bernhard R. Fischer, <bf@abenteuerland.at>
\date 2023/09/27

