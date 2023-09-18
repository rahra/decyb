/*! This file contains the code for all calculations.
 *
 * \file math.js
 * \author Bernhard R. Fischer <bf@abenteuerland.at>
 * \date 2023/09/15
 */


const LON = 0x01;
const LAT = 0x00;
const MIN = 0x02;
const DEC = 0x04;

/*! Format number into nautical coordinate format.
 */
function coord_str(pos, flags)
{
   var neg = 0;
   if (pos < 0)
   {
      neg = 1;
      pos = -pos;
   }

   var ipos = Math.floor(pos);
   var dec = ((pos - Math.floor(pos)) * 60).toFixed(flags & DEC ? 1 : 0);
   var dir;
   var pad;

   if (flags)
   {
      dir = neg ? 'W' : 'E';
      pad = pos < 10 ? '00' : (pos < 100 ? '0' : '');
   }
   else
   {
      dir = neg ? 'S' : 'N';
      pad = pos < 10 ? '0' : '';
   }

   return pad + ipos + '° ' + (flags & MIN ? (dec < 10 ? '0' : '') + dec : '') + (pos != 0.0 ? dir : '');;
}


function cmp_id(a, b)
{
   return a.id - b.id;
}


/*! Find if a boat passes a specific coordinate.
 * @param moments Array of trackpoints.
 * @param dim Dimension, is either LAT or LON.
 * @param val The value of the dimension in decimal degrees.
 */
function find_pass(moments, dim, val)
{
   var dims = dim == LAT ? "lat" : "lon";
   var v0, v1;
   for (var i = moments.length - 1; i > 0; i--)
   {
      v0 = moments[i][dims];
      v1 = moments[i - 1][dims];

      // catch longitude wrapping
      if (v0 - v1 >= 180)
         v1 = 360 + v1;
      else if (v0 - v1 <= -180)
         v1 = -360 + v1;

      if ((v0 >= val && v1 < val) || (v0 <= val && v1 > val))
         moments[i].name = coord_str(val, dim);
   }
}


/*! Find if a boat passes a specific latitude.
 */
function find_pass_lat(moments, lat)
{
   return find_pass(moments, LAT, lat);
}


/*! Find if a boat passes a specific longitude.
 */
function find_pass_lon(moments, lon)
{
   return find_pass(moments, LON, lon);
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
         CMath.coord_diff0(moments[i], rinfo_.nodes[j], d);
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


/*! Make strings to be displayed in the leaderboard.
 */
function display_string(team)
{
   return team.name + ", dist = " + team.data.moments[0].dist_tot.toFixed(1) + ", v_avg = " + team.v_avg.toFixed(2) + (team.status == "RACING" ? (team.board && team.board.dtf > 0 ? ", dtf = " + (team.board.dtf / 1852).toFixed(0) : "") : " (RETIRED)");
}


/*! This function just calls the calculation functions above for each track.
 */
function calc_data(setup)
{
   for (var i = 0; i < setup.teams.length; i++)
   {
      RaceMath.clean_moments(setup.teams[i].data.moments, setup.teams[i].start, setup.teams[i].hasOwnProperty("finishedAt") ? Math.min(time(), setup.teams[i].finishedAt) : time());
      //FIXME: the following depends on the global rinfo_. Should be moved out of here.
      remove_retired_moments(setup.teams[i].id, setup.teams[i].data.moments);
      setup.teams[i].visible = 0;
      setup.teams[i].t_move = RaceMath.calc_moments(setup.teams[i].data.moments);
      setup.teams[i].v_avg = setup.teams[i].data.moments[0].dist_tot * 3600 / setup.teams[i].t_move;
      setup.teams[i].display_name = display_string(setup.teams[i]);
      RaceMath.calc_dtf(setup.teams[i].data.moments, setup.course.nodes);
      //FIXME: the following depends on the global rinfo_. Should be moved out of here.
      calc_poi(setup.teams[i].data.moments);
      // find passing of equator
      find_pass_lat(setup.teams[i].data.moments, 0);
      // find passing the date line
      find_pass_lon(setup.teams[i].data.moments, 180);
      // passing Cape Horn
      find_pass_lon(setup.teams[i].data.moments, -67.292);
   }
}


function link_data(setup, data, board)
{
   for (var i = 0; i < setup.teams.length; i++)
   {
      setup.teams[i].data = data.find(d => d.id == setup.teams[i].id);
      for (var j = 0; j < board.tags.length; j++)
         if ((setup.teams[i].board = board.tags[j].teams.find(d => d.id == setup.teams[i].id)))
            break;
   }
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

   lat0 = CMath.DEG2RAD(lat0);
   lon0 = CMath.DEG2RAD(lon0);
   theta = CMath.DEG2RAD(theta);
   phi = CMath.DEG2RAD(phi);

   lat = Math.asin(Math.cos(theta) * Math.sin(lat0) - Math.cos(lon0) * Math.sin(theta) * Math.cos(lat0));
   lon = Math.atan2(Math.sin(lon0), Math.tan(lat0) * Math.sin(theta) + Math.cos(lon0) * Math.cos(theta)) - phi;

   lat0 = CMath.RAD2DEG(lat);
   lon0 = lonmod(CMath.RAD2DEG(lon));

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
   var xy = adams_square_ii(CMath.DEG2RAD(tc.lon), CMath.DEG2RAD(tc.lat));
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


function gen_lat(nodes, lat)
{
   for (var e = -180; e <= 180; e += 10)
      nodes.push({N: lat, E: e});
}


function gen_lon(nodes, lon)
{
   for (var n = 0; n <= 360; n += 10)
      nodes.push({N: n <= 180 ? n - 90 : 270 - n, E: n <= 180 ? lon : lonmod(lon + 180)});
}


/*! Add grid lines (equator and meridian) to the chart data in real geographic
 * coordinates.
 */
function gen_grid()
{
   var eq;

   eq = {type: "way", tags: {type: "equator"}, nodes: []};
   gen_lat(eq.nodes, 0);
   c_.push(eq);

   eq = {type: "way", tags: {type: "meridian"}, nodes: []};
   gen_lon(eq.nodes, 0);
   c_.push(eq);

   for (var n = 20; n <= 80; n += 20)
   {
      eq = {type: "way", tags: {type: "latitude", lat: n}, nodes: []};
      gen_lat(eq.nodes, n);
      c_.push(eq);
   }

   for (var n = -80; n <= -20; n += 20)
   {
      eq = {type: "way", tags: {type: "latitude", lat: n}, nodes: []};
      gen_lat(eq.nodes, n);
      c_.push(eq);
   }

   for (var e = 30; e < 180; e += 30)
   {
      eq = {type: "way", tags: {type: "longitude", lon: e}, nodes: []};
      gen_lon(eq.nodes, e);
      c_.push(eq);
   }
}


/*! This function add one POI from the RaceSetup to the map.
 */
function gen_poi0(line)
{
   const MINDIST = 5.0;

   if (line.nodes == undefined)
      return undefined;

   var c = line.nodes.split(",").map(x => parseFloat(x));

   // safety check, cp should have even number of elements
   if (c.length & 1) return;

   var w = {type: "way", tags: {type: "poi", polygon: line.polygon, colour: "#" + line.colour, name: line.name}, nodes: []};

   // add 1st point to the end in case of a closed polygon
   if (line.polygon)
      c.push(c[0], c[1]);

   for (var i = 0; i < c.length; i += 2)
   {
      w.nodes.push({N: c[i], E: c[i + 1]});
      if (i < c.length - 2)
      {
         var dlat = c[i + 2] - c[i];
         var dlon = c[i + 3] - c[i + 1];
         var h = Math.hypot(dlat, dlon);
         // add intermediate points if distance is to far (which is necessary to compensate the distorsion caused by the Admas Square II projection).
         if (h > MINDIST)
         {
            var n = Math.ceil(h / MINDIST);
            for (var j = 1; j < n; j++)
               w.nodes.push({N: c[i] + dlat / n * j, E: c[i + 1] + dlon / n * j});
         }
      }
   }

   // add data to map data
   c_.push(w);
}


/*! This function adds the POI data found in the RaceSetup to the map.
 */
function gen_poi(lines)
{
   for (var i = 0; i < lines.length; i++)
      gen_poi0(lines[i]);
}

