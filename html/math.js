/*! This file contains the code for all calculations.
 *
 * \file math.js
 * \author Bernhard R. Fischer <bf@abenteuerland.at>
 * \date 2022/10/04
 */


function DEG2RAD(d)
{
   return d * Math.PI / 180;
}


function RAD2DEG(r)
{
   return r * 180 / Math.PI;
}


function fmod2(a)
{
   for (; a >= 360; a -= 360);
   for (; a < 0; a += 360);
   return a;
}


/*! Calculate the orthodrome distance between to geographic coordinates src and
 * dst defined by latitude and longitude. The result is stored as distance in
 * nautical miles and bearing in degrees dst2.
 */
function coord_diff0(src, dst, dst2)
{
   var dlat, dlon;
   var dist, bearing;

   dlat = dst.lat - src.lat;
   dlon = (dst.lon - src.lon) * Math.cos(DEG2RAD((src.lat + dst.lat) / 2.0));

   dst2.bearing = fmod2(RAD2DEG(Math.atan2(dlon, dlat)));
   dst2.dist = 60 * RAD2DEG(Math.acos(
      Math.sin(DEG2RAD(src.lat)) * Math.sin(DEG2RAD(dst.lat)) +
      Math.cos(DEG2RAD(src.lat)) * Math.cos(DEG2RAD(dst.lat)) * Math.cos(DEG2RAD(dst.lon - src.lon))));
}


/*! This is a wrapper function for coord_diff0(). It stores the result directly
 * into dst.
 */
function coord_diff(src, dst)
{
   coord_diff0(src, dst, dst);
}


const LON = 0x01;
const LAT = 0x00;
const MIN = 0x02;
const DEC = 0x04;

/*! Format number into nautical coordinate format.
 */
function coord_str(pos, flags)
{
   var ipos = Math.floor(pos);
   var dec = ((pos - Math.floor(pos)) * 60).toFixed(flags & DEC ? 1 : 0);
   var dir;
   var pad;

   if (flags)
   {
      dir = pos < 0 ? 'W' : 'E';
      pad = pos < 10 ? '00' : (pos < 100 ? '0' : '');
   }
   else
   {
      dir = pos < 0 ? 'S' : 'N';
      pad = pos < 10 ? '0' : '';
   }

   return pad + ipos + '° ' + (flags & MIN ? (dec < 10 ? '0' : '') + dec : '') + (pos != 0.0 ? dir : '');;
}


/*! Find if a boat passes a specific latitude.
 */
function find_pass_lat(moments, lat)
{
   for (var i = moments.length - 1; i > 0; i--)
      if ((moments[i].lat >= lat && moments[i - 1].lat < lat) || (moments[i].lat <= lat && moments[i - 1].lat > lat))
         moments[i].name = coord_str(lat, LAT);
}


/*! This function finds the nearest track points to the points defined in the
 * global array rinfo_.nodes. Nodes_ contains track marks such as the film
 * drops.
 * FIXME: rinfo_.nodes is currently manually defined although the data is found
 * in the RaceSetup. This will be rewritten.
 */
function calc_poi(moments)
{
   for (var j = 0; j < rinfo_.nodes.length; j++)
   {
      var d = {};
      var dist = 100000;
      var ix = moments.length;
      for (var i = moments.length - 1; i >= 0; i--)
      {
         coord_diff0(moments[i], rinfo_.nodes[j], d);
         if (d.dist < dist)
         {
            dist = d.dist;
            ix = i;
         }
      }

      // Mark chosen trackpoint if distance < 100 nm. (It's assumed the the point was not reached of the distance is >100 nm.)
      if (dist < 100)
         moments[ix].name = rinfo_.nodes[j].name;
   }
}


/*! This function returns to current time as a Unix timestamp in seconds.
 */
function time()
{
   return Math.floor(Date.now() / 1000);
}


/*! This function eliminates moments which happen in the future (according to
 * the timestamp) or which occured before the start of the race.
 */
function clean_moments(moments, t_min)
{
   // remove elements before the start
   for (; moments.slice(-1)[0].at < t_min;)
      moments.pop();
   // remove elements which are in the future
   for (; moments[0].at > time();)
      moments.shift();
}


/*! This function calculates the distance and bearing of the basic intend
 * course to go. The track points are ordered ascendingly in the RaceSetup
 * data.
 */
function calc_course(moments)
{
   var dst = {bearing: 0, dist: 0};
   moments[0].dist = moments[0].dist_tot = moments[0].bearing = 0;
   for (var i = 0; i < moments.length - 1; i++)
   {
      coord_diff0(moments[i], moments[i + 1], dst);
      moments[i].bearing = dst.bearing;
      moments[i + 1].dist = dst.dist;
      moments[i + 1].dist_tot = moments[i].dist_tot + dst.dist;
   }
   console.log(moments);
}


/*! Calculate the difference between 2 bearings (0 - 360).
 * @return The function always returns a value -180 <= v <= 180.
 */
function diff_bearing(bear_mom, bear_course)
{
   var b = bear_mom - bear_course;
   return b > 180 ? b - 360 : b;
}


/*! The function calculates if a bearing calculate from a moment does not
 * deviate more than 90 degrees to starboard (+90) or portside (-90).
 */
function coursepoint_in_sight(bear_mom, bear_course)
{
   var v = diff_bearing(bear_mom, bear_course);
   return v < 90 && v > -90;
}


/*! This function calculates the DMG and the DTF for every moment of each
 * participant's track.
 */
function calc_dtf(moments, course)
{
   var dist_tot = course[course.length - 1].dist_tot;
   var dst = {};
   var i = moments.length - 1;
   for (var j = 0; j < course.length && i < moments.length; j++)
   {
      for (; i >= 0; i--)
      {
         coord_diff0(moments[i], course[j], dst);
         if (!coursepoint_in_sight(dst.bearing, course[j].bearing))
            break;
         moments[i].dtf = dist_tot - course[j].dist_tot + dst.dist;
         moments[i].dmg = course[j].dist_tot - dst.dist;
      }
   }
   console.log(moments);
}


/* This function does some initial calculations in the track data. It
 * calculates the distance, the total distance, the bearing, and the average
 * speed for each track point, and it finds the point with the highest average
 * speed.
 * The trackpoints are ordered descendingly, so the latest point in time is the
 * first point in the arrays.
 */
function calc_moments(moments, t_min)
{
   var ix = -1, v_avg = 0;

   // set distance of 1st point to 0
   moments[moments.length - 1].td = moments[moments.length - 1].dist = moments[moments.length - 1].dist_tot = 0;
   for (var i = moments.length - 1; i; i--)
   {
      coord_diff(moments[i], moments[i - 1]);
      moments[i - 1].dist_tot = moments[i - 1].dist + moments[i].dist_tot;

      moments[i - 1].td = moments[i - 1].at - moments[i].at;
      moments[i - 1].v_avg = moments[i - 1].td ? moments[i - 1].dist / moments[i - 1].td * 3600 : 0;

      // find max avg speed
      if (moments[i - 1].v_avg > v_avg)
      {
         v_avg = moments[i - 1].v_avg;
         ix = i - 1;
      }
   }

   // set max speed
   if (ix != -1)
      moments[ix].v_avg_max = 1;
}
 

/*! Remove all track points (moments) after time of retirement.
 */
function remove_retired_moments(id, moments)
{
   for (var i = 0; i < rinfo_.retired.length; i++)
   {
      if (rinfo_.retired[i].id != id)
         continue;

      for (; moments.length && moments[0].at > rinfo_.retired[i].at;)
         moments.shift();
   }
}


/*! This function just calls the calculation functions above for each track.
 */
function calc_data(setup_, data_)
{
   for (var i = 0; i < data_.length; i++)
   {
      clean_moments(data_[i].moments, setup_.teams[i].start);
      remove_retired_moments(data_[i].id, data_[i].moments);
      setup_.teams[i].visible = 0;
      calc_moments(data_[i].moments, setup_.teams[i].start);
      calc_dtf(data_[i].moments, setup_.course.nodes);
      calc_poi(data_[i].moments);
      // find passing of equator
      find_pass_lat(data_[i].moments, 0);
   }
}


/*! This function does a safety check, if the order of tracks and teams found
 * in "AllPositions3" and "RaceSetup" is the same (which seams to be at the
 * moment). Otherwise the data would have to be resorted by the "id" which
 * identifies the data.
 * So this function currently is for debugging. In a future release I'll
 * directly take care on the id instead of the arrays indexes.
 */
function data_check(setup_, data_)
{
   for (var i = 0; i < data_.length; i++)
      if (data_[i].id != setup_.teams[i].id)
         console.log(data_[i].id + " != " + setup_.teams[i].id);
}


function lonmod(lon)
{
   while (lon < -180)
      lon += 360;
   while (lon > 180)
      lon -= 360;
   return lon;
}


/*! This function rotates a geographic location given by lat0/lon0 in a
 * 3-dimensional reference system by the angles theta and phi along the x and y
 * axis.
 */
function transcoord(theta, phi, lat0, lon0)
{
   var lat, lon;

   lat0 = DEG2RAD(lat0);
   lon0 = DEG2RAD(lon0);
   theta = DEG2RAD(theta);
   phi = DEG2RAD(phi);

   lat = Math.asin(Math.cos(theta) * Math.sin(lat0) - Math.cos(lon0) * Math.sin(theta) * Math.cos(lat0));
   lon = Math.atan2(Math.sin(lon0), Math.tan(lat0) * Math.sin(theta) + Math.cos(lon0) * Math.cos(theta)) - phi;

   lat0 = RAD2DEG(lat);
   lon0 = lonmod(RAD2DEG(lon));

   return {lat: lat0, lon: lon0};
}


/*! This translates the coordinate tc to the Spilhaus reference system.
 */
function trans_spilhaus(tc)
{
   var trans = [
      {tlat: 0, tlon: 66.94970198},
      {tlat: 40.43628322, tlon: 0},
      {tlat: 0, tlon: 40.18},
      {tlat: -90, tlon: 0},
      ];
   for (var i = 0; i < trans.length; i++)
      tc = transcoord(trans[i].tlat, trans[i].tlon, tc.lat, tc.lon);

   return tc;
}


/*! This is the final step of the Adams Square II projection to scale the x/y
 * coordinates to the square plane.
 */
function coords_xy(s, tc)
{
   var xy = adams_square_ii(DEG2RAD(tc.lon), DEG2RAD(tc.lat));
   xy.x = ((xy.x + A2_LAM_SCALE) * s) / (2 * A2_LAM_SCALE);
   xy.y = s - ((xy.y + A2_PHI_SCALE) * s) / (2 * A2_PHI_SCALE);
   return xy;
}


/*! This function calculates the x/y coordinates of each map point. It's done
 * by translate each geographic coordinate into the Spilhaus reference system
 * and then applying the Adams Square II projection.
 */
function calc_chart()
{
   for (i = 0; i < c_.length; i++)
   {
      var olon;
      for (j = 0; j < c_[i].nodes.length; j++)
      {
         var tc = trans_spilhaus({lat: c_[i].nodes[j].N, lon: c_[i].nodes[j].E});
         var xy = coords_xy(1, tc);
         c_[i].nodes[j].x = xy.x;
         c_[i].nodes[j].y = xy.y;
         c_[i].nodes[j].split = 0;
         if (j)
         {
            var dlon = tc.lon - olon;
            olon = tc.lon;
            if (Math.abs(dlon) > 180)
               c_[i].nodes[j].split = 1;
         }
      }
   }
}


/*! Add grid lines (equator and meridian) to the chart data in real geographic
 * coordinates.
 */
function gen_grid()
{
   var eq;

   eq = {type: "way", tags: {type: "equator"}, nodes: []};
   for (var e = -180; e <= 180; e += 10)
      eq.nodes.push({N: 0, E: e});
   c_.push(eq);

   eq = {type: "way", tags: {type: "meridian"}, nodes: []};
   for (var n = -90; n <= 90; n += 10)
      eq.nodes.push({N: n, E: 0});
   for (; n >= -90; n -= 10)
      eq.nodes.push({N: n, E: 180});
   c_.push(eq);
}

