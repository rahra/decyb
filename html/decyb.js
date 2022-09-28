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
 * global array nodes_. Nodes_ contains track marks such as the film drops.
 * FIXME: nodes_ is currently manually defined although the data is found in
 * the RaceSetup. This will be rewritten.
 */
function calc_poi(moments)
{
   for (var j = 0; j < nodes_.length; j++)
   {
      var d = {};
      var dist = 100000;
      var ix = moments.length;
      for (var i = moments.length - 1; i >= 0; i--)
      {
         coord_diff0(moments[i], nodes_[j], d);
         if (d.dist < dist)
         {
            dist = d.dist;
            ix = i;
         }
      }

      // Mark chosen trackpoint if distance < 100 nm. (It's assumed the the point was not reached of the distance is >100 nm.)
      if (dist < 100)
         moments[ix].name = nodes_[j].name;
   }
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
      // ignore data before start of race
      if (moments[i - 1].at <= t_min)
      {
         moments[i - 1].td = moments[i - 1].dist = moments[i - 1].dist_tot = 0;
         continue;
      }
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
 

/*! This function just calls the calculation functions above for each track.
 */
function calc_data(setup_, data_)
{
   for (var i = 0; i < data_.length; i++)
   {
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


/*! This function initially fetches the race data from the YB server.
 */
function get_data(server)
{
   fetch('https://' + server + '/JSON/ggr2022/RaceSetup')
   .then((response) => response.json())
   .then((setup) => {
      fetch('https://' + server + '/BIN/ggr2022/AllPositions3')
      .then((response) => response.arrayBuffer())
      .then((data) => {
         var jdata = parse(data);
         save_data(setup, jdata);
         calc_data(setup, jdata);
         //document.getElementById("pre").innerHTML = JSON.stringify(jdata, null, 2);
         update_graph();
      })
   });
}

