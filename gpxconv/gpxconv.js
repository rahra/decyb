/*! With this tool you can convert your own GPX track into the YB JSON formats
 * necessary to use this data viewer.
 * This program is written in Javascript. You need to have 'node' and 'npm'
 * installed in order to run this. It depends on the module 'GpxParser'
 * (https://github.com/Luuka/GPXParser.js). Install it with `npm install --save
 * gpxparser`.
 *
 * You need your GPX track and a race course in GPX format as well. Even if you
 * didn't race create a track with any tool which shows the original intended
 * route of your journey.  * Then modify the file RaceSetup.template.json
 * according to your needs. Finally start the converter by running the command
 * `./gpxconv <yourtrack.gpx> <yourracecourse.gpx>`.
 * Please note that the trackpoints in your file should be in strict ascending
 * time order.
 *
 * \author Bernhard R. Fischer, <bf@abenteuerland.at>
 * \date 2023/09/27
 */

const proc = require("process");
const fs_ = require("fs");
const GpxParser = require("gpxparser");

const rm_ = require("../html/racemath");
const GetOpts = require("./getopts");

//! parsed argument list
const args = new GetOpts();
//! filename of track
var fn_track;
//! filename of race course
var fn_course;
//! data structure which receives the track points
var data = [{"id": 1, "moments": []}];
//! race setup data, read from JSON file
var setup = JSON.parse(fs_.readFileSync("./RaceSetup.template.json"));
if (!setup.hasOwnProperty("course"))
   setup.course = {nodes: [], distance: 0};
//! empty minimal leadboard structure
var board =
{
   "tags":
   [
      {
         "teams":
         [
            {
               "started": true,
               "finishd": false,
               "id": 1,
               "dmg": 0,
               "dtf": 0,
               "status": "RACING"
            }
         ]
      }
   ]
};


/*! Output short usage message and exit.
 */
function usage()
{
   const umsg =
      "usage: " + proc.argv[0] + " " + proc.argv[1] + " <track.gpx> <course.gpx> [options]\n" +
      "   options\n" +
      "   -a .......... Calculate additional data for each trackpoint.";
   console.log(umsg);
   proc.exit(1);
}


/*! Parse command line arguments.
 */
function parse_args()
{
   fn_track = args.getarg(0).value;
   fn_course = args.getarg(1).value;
   if (fn_track === undefined || fn_course === undefined)
      usage();
}


/*! Read track data from GPX file.
 */
function read_track(name)
{
   const fb = fs_.readFileSync(name).toString();
   const btrk = new GpxParser();
   btrk.parse(fb);

   for (var t = 0; t < btrk.tracks.length; t++)
   {
      for (var i = 0; i < btrk.tracks[t].points.length; i++)
      {
         var ts = Math.floor(new Date(btrk.tracks[t].points[i].time).getTime() / 1000);
         data[0].moments.unshift({"dtf": 0, "lat": btrk.tracks[t].points[i].lat, "lon": btrk.tracks[t].points[i].lon, "at": ts});
         // check for sorting error
         if (data[0].moments.length >= 2 && data[0].moments[0].at < data[0].moments[1].at)
            console.log("time sort error:" + data[0].moments[0].at);
      }
   }
}


/*! Read race course from GPX file.
 */
function read_course(name)
{
   const fr = fs_.readFileSync(name).toString();
   const rtrk = new GpxParser();
   rtrk.parse(fr);

   for (var t = 0; t < rtrk.tracks.length; t++)
      for (var i = 0; i < rtrk.tracks[t].points.length; i++)
         setup.course.nodes.push({lon: rtrk.tracks[t].points[i].lon, lat: rtrk.tracks[t].points[i].lat});
}


parse_args();
read_track(fn_track);
read_course(fn_course);

setup.course.distance = rm_.calc_course(setup.course.nodes);

if (args.getopt("a") !== undefined)
{
   setup.teams[0].t_move = rm_.calc_moments(data[0].moments, 0.05);
   setup.teams[0].v_avg = data[0].moments[0].dist_tot * 3600 / setup.teams[0].t_move;

   rm_.calc_dtf(data[0].moments, setup.course.nodes);
   rm_.calc_tdist(data[0].moments, 3600 * 24);
   rm_.calc_tdist(data[0].moments, 3600 * 24 * 7);
}

fs_.writeFileSync("AllPositions3.json", JSON.stringify(data));
fs_.writeFileSync("RaceSetup.json", JSON.stringify(setup));
fs_.writeFileSync("leaderboard.json", JSON.stringify(board));

/* debug output
for (var i = 0; i < data[0].moments.length; i++)
   if (data[0].moments[i].hasOwnProperty("dist_t"))
      for (var j = 0; j < data[0].moments[i].dist_t.length; j++)
         if (data[0].moments[i].dist_t[j].t_exp == 3600 * 24 * 7)
            console.log("dist = " + data[0].moments[i].dist_t[j].dist + ", v_avg = " + data[0].moments[i].dist_t[j].v_avg + ", t = " + data[0].moments[i].dist_t[j].t);
*/

