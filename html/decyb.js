/*! Race data viewer by Bernhard R. Fischer <bf@abenteuerland.at>
 * This is an (almost) generic viewer of the YB race data.
 * This version here is written specifically for the GGR2022 but it should work
 * with any other race as well.
 *
 * \author Bernhard R. Fischer <bf@abenteuerland.at>
 * \date 2022/09/28
 */

const NDIST = 20;
const TEXTX = 80;
const BORDER = 0.025;
const DEFX = 1920;
const DEFY = 1080;

//! color scheme definitions
const cscheme_ = [{bg: "#171717", cap: "#b0b0b0", xbg: "#b0b0b030", tx: "#c0c0c0"}, {bg: "#e8e8d8", cap: "#404040", xbg: "#000000b0", tx: "#e8e8e8"}];
var cur_scheme_ = 0;
var col_ = cscheme_[cur_scheme_];

var tw_;

/*! This function is the parser for the binary track data. The function is
 * directly taken from the original YB code. The Github repository contains a
 * completely rewritten and mor readable version in C by me.
 */
function parse(e)
{
   for (var t = new DataView(e), i = t.getUint8(0), a = 1 === (1 & i), s = 2 === (2 & i), n = 4 === (4 & i), r = 8 === (8 & i), o = t.getUint32(1), l = 5, c = []; l < e.byteLength;) {
       var u = t.getUint16(l);
       l += 2;
       var h = t.getUint16(l),
           d = new Array(h);
       l += 2;
       for (var g = void 0, v = 0; v < h; v++) {
           var p = t.getUint8(l),
               m = {};
           if (128 === (128 & p)) {
               var w = t.getUint16(l);
               l += 2;
               var y = t.getInt16(l);
               l += 2;
               var M = t.getInt16(l);
               if (l += 2, a && (m.alt = t.getInt16(l), l += 2), s) {
                   var f = t.getInt16(l);
                   l += 2, m.dtf = g.dtf + f, n && (m.lap = t.getUint8(l), l++)
               }
               r && (m.pc = t.getInt16(l) / 32e3, l += 2), w = 32767 & w, m.lat = g.lat + y, m.lon = g.lon + M, m.at = g.at - w, m.pc = g.pc + m.pc
           } else {
               var T = t.getUint32(l);
               l += 4;
               var b = t.getInt32(l);
               l += 4;
               var L = t.getInt32(l);
               if (l += 4, a && (m.alt = t.getInt16(l), l += 2), s) {
                   var x = t.getInt32(l);
                   l += 4, m.dtf = x, n && (m.lap = t.getUint8(l), l++)
               }
               r && (m.pc = t.getInt32(l) / 21e6, l += 4), m.lat = b, m.lon = L, m.at = o + T
           }
           d[v] = m, g = m
       }
       d.forEach(function(e) {
           e.lat /= 1e5, e.lon /= 1e5
       }), c.push({
           id: u,
           moments: d
       })
      }
      return c
}


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


/* This function does some initial calculations in the track data. It
 * calculates the distance, the total distance, the bearing, and the average
 * speed for each track point, and it finds the point with the highest average
 * speed.
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

      if (moments[i - 1].hasOwnProperty("at"))
      {
         moments[i - 1].td = moments[i - 1].at - moments[i].at;
         moments[i - 1].v_avg = moments[i - 1].td ? moments[i - 1].dist / moments[i - 1].td * 3600 : 0;

         // find max avg speed
         if (moments[i - 1].v_avg > v_avg)
         {
            v_avg = moments[i - 1].v_avg;
            ix = i - 1;
         }
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


/*! This function draws the average speed curves.
 */
function draw_v_avg(C, moments, setup)
{
   var ix = -1;

   C.ctx.save();
   C.ctx.translate(0, C.d_max * C.sy);
   C.ctx.beginPath();
   C.ctx.moveTo(0, C.v_max * C.sy2);
   for (var i = moments.length - 1; i >= 0; i--)
   {
      C.ctx.lineTo((moments[i].at - C.t_min) * C.sx, (C.v_max - moments[i].v_avg) * C.sy2);
      if (moments[i].hasOwnProperty("v_avg_max"))
         ix = i;
   }
   C.ctx.stroke();

   if (ix >= 0)
   {
      //C.ctx.strokeStyle = "#f00000";
      C.ctx.fillStyle = "#f00000";
      C.ctx.beginPath();
      C.ctx.arc((moments[ix].at - C.t_min) * C.sx, (C.v_max - moments[ix].v_avg) * C.sy2, 3, 0, 2 * Math.PI);
      C.ctx.fill();
      C.ctx.fillText("v_avg_max = " + moments[ix].v_avg.toFixed(1), (moments[ix].at - C.t_min) * C.sx, (C.v_max - moments[ix].v_avg) * C.sy2 - 3);
   }
   C.ctx.restore();
}


function draw_moments_map(C, moments)
{
   C.ctx.save();
   C.ctx.translate(C.width / 2, C.height / 2);
   C.ctx.rotate(Math.PI / 8);
 
   C.ctx.beginPath();
   //C.ctx.moveTo(0, C.d_max * C.sy);
   for (var i = moments.length - 1; i >= 0; i--)
   {
      var tc = trans_spilhaus({lat: moments[i].lat, lon: moments[i].lon});
      var xy = coords_xy(C.width, tc);

      C.ctx.lineTo(xy.x - C.width/2, xy.y - C.width/2);
   }
   C.ctx.stroke();
   C.ctx.restore();
}


/*! This function draws the distance curves.
 */
function draw_moments(C, moments)
{
   C.ctx.beginPath();
   C.ctx.moveTo(0, C.d_max * C.sy);
   for (var i = moments.length - 1; i >= 0; i--)
   {
      // ignore everything before race start
      if (moments[i].at < C.t_min)
         continue;

      C.ctx.lineTo((moments[i].at - C.t_min) * C.sx, (C.d_max - moments[i].dist_tot) * C.sy);
   }
   C.ctx.stroke();
}


/*! This function draws the tracks marks (e.g. film drops) onto the distance
 * curves.
 */
function draw_marks(C, moments)
{
   var AR = 4;
   C.ctx.save();
   C.ctx.fillStyle = "#d00000";
   for (var i = moments.length - 1; i >= 0; i--)
      if (moments[i].hasOwnProperty("name"))
      {
         C.ctx.beginPath();
         C.ctx.arc((moments[i].at - C.t_min) * C.sx, (C.d_max - moments[i].dist_tot) * C.sy, AR, 0, 2 * Math.PI);
         C.ctx.fill();
         C.ctx.fillText(moments[i].name, (moments[i].at - C.t_min) * C.sx, (C.d_max - moments[i].dist_tot) * C.sy - AR);
      }
   C.ctx.restore();
}


/*! This function prints the caption of the diagram.
 */
function caption(C)
{
   var text = title_.split("\n");
   var w = 0;

   for (var i = 0; i < text.length; i++)
      w = Math.max(w, C.ctx.measureText(text[i]).width);

   C.ctx.save();
   C.ctx.beginPath();
   C.ctx.fillStyle = col_.xbg;
   C.ctx.rect((C.t_max - C.t_min) * C.sx * 0.33 - 5, 0, w + 10, 20 * (text.length + .5));
   C.ctx.fill();

   C.ctx.beginPath();
   C.ctx.fillStyle = col_.tx;
   for (var i = 0; i < text.length; i++)
      C.ctx.fillText(text[i], (C.t_max - C.t_min) * C.sx * 0.33, 20 * (i + 1));
  C.ctx.restore();
}


/*! This function draws the axis, grid lines, and the diagram captions.
 */
function axis(C)
{
   const XDIFF = 20;
   const YDIFF = 20;

   C.ctx.save();
   C.ctx.fillStyle = col_.cap;
   C.ctx.strokeStyle = col_.cap;
   C.ctx.lineWidth = 1;
   C.ctx.setLineDash([6,4]);

   // x axis
   C.ctx.save();
   //C.ctx.translate(0, C.d_max * C.sy);
   var t_diff = (C.t_max - C.t_min) / XDIFF;
   for (var t = C.t_min, td = new Date(); t < C.t_max ; t += t_diff)
   {
      C.ctx.beginPath();
      C.ctx.moveTo(0, 0);
      C.ctx.lineTo(0, C.height /*-C.d_max * C.sy*/);
      C.ctx.stroke();
      td.setTime(t * 1000);
      C.ctx.save();
      C.ctx.translate(0, C.height * 0.7);
      C.ctx.rotate(-Math.PI / 2);
      C.ctx.fillText(td.toUTCString(), 0, -4);
      C.ctx.restore();
      C.ctx.translate(t_diff * C.sx, 0);
   }
   C.ctx.restore();

   C.ctx.save();
   C.ctx.translate(0, C.d_max * C.sy);
   var d_diff = C.d_max / YDIFF;
   for (var d = 0; d < C.d_max; d += d_diff)
   {
      C.ctx.beginPath();
      C.ctx.moveTo(0, 0);
      C.ctx.lineTo((C.t_max - C.t_min) * C.sx, 0);
      C.ctx.stroke();
      var ds = d.toFixed(0) + " nm";
      C.ctx.fillText(ds, 0, 0);
      C.ctx.translate(0, -d_diff * C.sy);
   }
   C.ctx.restore();

   C.ctx.save();
   C.ctx.translate(0, C.d_max * C.sy + C.v_max * C.sy2);
   var v_diff = C.v_max / 10;
   for (var v = 0; v < C.v_max; v += v_diff)
   {
      C.ctx.beginPath();
      C.ctx.moveTo(0, 0);
      C.ctx.lineTo((C.t_max - C.t_min) * C.sx, 0);
      C.ctx.stroke();
      var vs = v.toFixed(0) + " kts";
      C.ctx.fillText(vs, 0, 0);
      C.ctx.translate(0, -v_diff * C.sy2);
   }
   C.ctx.restore();

   C.ctx.restore();
}


/*! This helper function determins the maximum width of the name box.
 */
function measure_names(C, setup_, data_)
{
   var w = 0;
   C.ctx.save();
   C.ctx.font = "bold 14px sans-serif";
   for (var i = 0; i < data_.length; i++)
   {
      var v_avg = data_[i].moments[0].dist_tot * 3600 / (data_[i].moments[0].at - data_[i].moments[data_[i].moments.length - 1].at);
      w = Math.max(w, C.ctx.measureText(setup_.teams[i].name + ", dist = " + data_[i].moments[0].dist_tot.toFixed(1) + ", v_avg = " + v_avg.toFixed(2)).width);
   }
   C.ctx.restore();
   return w;
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


/*! This function plots the map having the coordinates x/y of each point
 * already pre-calculated (done in calc_chart()). It also does the final 45
 * degree rotation to Adams Square II projected coordinates to resemble the
 * Spilhaus projection.
 */
function draw_map(C)
{
   var s = C.width;

   C.ctx.save();
   C.ctx.translate(C.width / 2, C.height / 2);
   C.ctx.rotate(Math.PI / 8);
   C.ctx.lineWidth = 2;
   for (i = 0; i < c_.length; i++)
   {
      C.ctx.strokeStyle = c_[i].tags.type == "meridian" || c_[i].tags.type == "equator" ? "#606000" : "#801000";
      C.ctx.beginPath();
      var olon;
      for (j = 0; j < c_[i].nodes.length; j++)
      {
         if (c_[i].nodes[j].split)
         {
            C.ctx.stroke();
            C.ctx.beginPath();
         }
         C.ctx.lineTo(c_[i].nodes[j].x*s - s/2, c_[i].nodes[j].y*s - s/2);
      }
      C.ctx.stroke();
   }
   C.ctx.restore();
}


/*! This function is the main drawing function and draws the complete diagram.
 */
function draw_data(setup_, data_)
{
   // drawing parameters
   var C =
      {
         t_min: Math.floor(Date.now() / 1000),
         t_max: 0, 
         d_max: 0,
         v_max: 10,
         sx: 0,
         sy: 0,
         sy2: 0,
         width: DEFX,
         height:DEFY 
      };

   data_check(setup_, data_);
   document.body.style.backgroundColor = col_.bg;
   var canvas = document.getElementById("chart");
   C.ctx = canvas.getContext("2d");
   C.width = canvas.width = window.innerWidth;
   C.height = canvas.height = window.innerHeight;

   C.ctx.translate(C.width * BORDER, C.height * BORDER);
   //C.ctx.scale(0.95, 0.95);

   C.t_min = setup_.teams[0].start;
   for (var i = 0; i < data_.length; i++)
   {
      //C.t_min = Math.min(C.t_min, data_[i].moments[data_[i].moments.length - 1].at);
      C.t_max = Math.max(C.t_max, data_[i].moments[0].at);
      C.d_max = Math.max(C.d_max, data_[i].moments[0].dist_tot);
   }

   var ysplit = 0.8;
   C.sx = C.width / (C.t_max - C.t_min) * (1 - 2 * BORDER);
   C.sy = C.height / C.d_max * ysplit * (1 - 2 * BORDER);
   C.sy2 = C.height / C.v_max * (1 - ysplit) * (1 - 2 * BORDER);

   C.ctx.lineWidth = 1;
   C.ctx.font = "14px sans-serif";

   draw_map(C);
   axis(C);
   caption(C);

   tw_ = measure_names(C, setup_, data_);

   C.ctx.fillStyle = col_.xbg;
   C.ctx.rect(TEXTX - 10, 0, tw_, data_.length * NDIST + 10);
   C.ctx.fill();

   for (var i = 0; i < data_.length; i++)
   {
      if (_a == i || setup_.teams[i].visible)
      {
         o = "ff";
         C.ctx.font = "bold 14px sans-serif";
      }
      else
      {
         o = "e0";
         C.ctx.font = "14px sans-serif";
      }
      C.ctx.lineWidth = _a == i ? 3 : 1;
      C.ctx.strokeStyle = "#" + setup_.teams[i].colour + o;
      C.ctx.fillStyle = "#" + setup_.teams[i].colour + o;

      var v_avg = data_[i].moments[0].dist_tot * 3600 / (data_[i].moments[0].at - data_[i].moments[data_[i].moments.length - 1].at);
      C.ctx.fillText(setup_.teams[i].name + ", dist = " + data_[i].moments[0].dist_tot.toFixed(1) + ", v_avg = " + v_avg.toFixed(2), TEXTX, (i+1) * NDIST);

      if (!setup_.teams[i].visible && _a != i)
         continue;

      draw_moments(C, data_[i].moments);
      draw_moments_map(C, data_[i].moments);
      draw_marks(C, data_[i].moments);
      draw_v_avg(C, data_[i].moments);
   }
}



// some global variables (_s: RaceSetup, _j: AllPositions3, _a: mouse over name index
// FIXME: I hate this, but due to a lack of understanding of the fetch/then
// construction I was yet unable to write this in a proper manner.
var _s, _j, _a = -1;


/*! This function determines the current mouse position of an event and detects
 * if the mouse is hovered over a participant, and which index it is.
 */
function handle_mouse_pos(e)
{
   var mx = e.pageX - document.getElementById("chart").getBoundingClientRect().left;
   var my = e.pageY - document.getElementById("chart").getBoundingClientRect().top;

   var x = window.innerWidth * BORDER;
   var y = window.innerHeight * BORDER;
   _a = mx >= x + TEXTX && mx < x + TEXTX + tw_ && my >= y && my < _j.length * NDIST + y ? Math.floor((my - y) / NDIST) : -1;
}


/*! The mouse move handler is called every time when the mouse is moved.
 */
function mouse_move_handler(e)
{
   handle_mouse_pos(e);
   update_graph();
}


/*! The mouse click handler is called at every mouse click. It enables/disables
 * the chosen curves by setting the visibility member.
 * Otherwise it switches the color scheme.
 */
function mouse_click_handler(e)
{
   handle_mouse_pos(e);

   if (_a >= 0 && _a < _s.teams.length)
      _s.teams[_a].visible ^= 1;
   else
   {
      cur_scheme_ = (cur_scheme_ + 1) % cscheme_.length;
      col_ = cscheme_[cur_scheme_];
   }

   update_graph();
}


/*! This helper function puts the loaded data from the network into the global
 * variables.
 */
function save_data(setup, jdata)
{
   _s = setup;
   _j = jdata;
}


/*! This function is a wrapper for draw_data(). It is called by the window
 * resize event.
 */
function update_graph()
{
   draw_data(_s, _j);
}


/*! This function corrects to timestamps of the VDH track to the current race
 * and adds to track to the ggr2022 race data.
 */
function prep_vdh(setup, data)
{
   const diff = 1662300000 - 1530439200;
   for (var i = 0; i < vdhd_.moments.length; i++)
      vdhd_.moments[i].at += diff;
   data.push(vdhd_);
   setup.teams.push(vdhs_);
}


/*! This function initially fetches the race data from the YB server.
 */
function get_data(server)
{
   fetch('https://' + server + '/JSON/ggr2022/leaderboard')
   .then((response) => response.json())
   .then((board) => {
   fetch('https://' + server + '/JSON/ggr2022/RaceSetup')
   .then((response) => response.json())
   .then(function(setup) {
   fetch('https://' + server + '/BIN/ggr2022/AllPositions3')
   .then((response) => response.arrayBuffer())
   .then((bindata) => parse(bindata))
   .then((data) => {
      save_data(setup, data);
      gen_grid();
      calc_chart();
      prep_vdh(setup, data);
      calc_moments(setup.course.nodes, 0);
      calc_data(setup, data);
      //document.getElementById("pre").innerHTML = JSON.stringify(jdata, null, 2);
      update_graph();
   })
   })
   });
}


/*! Add all event handlers.
 */
function add_events()
{
   window.addEventListener('resize', function(e){update_graph()});
   document.getElementById("chart").addEventListener('mousemove', function(e){mouse_move_handler(e);});
   document.getElementById("chart").addEventListener('click', function(e){mouse_click_handler(e);});
}

window.addEventListener('load', add_events);

