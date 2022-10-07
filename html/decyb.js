/*! Race data viewer by Bernhard R. Fischer <bf@abenteuerland.at>
 * This is an (almost) generic viewer of the YB race data.
 * This version here is written specifically for the GGR2022 but it should work
 * with any other race as well.
 *
 * This file contains the code for fetching and decoding the data from the YB
 * server and it contains the code for all graphics output.
 * The calculations are done in math.js and adams.js.
 *
 * \file decyb.js
 * \author Bernhard R. Fischer <bf@abenteuerland.at>
 * \date 2022/10/04
 */

const NDIST = 20;
const TEXTX = 80;
const BORDER = 0.025;
const DEFX = 1920;
const DEFY = 1080;
const BUTTONW = 120;
const BUTTONH = 25;

//! globale dynamic settings
var G =
{
   mo_index: -1,
   bt_index: -1,
   bt:
   [
      {name: "INFO", enabled: 0},
      {name: "MAP", enabled: 1},
      {name: "DIAGRAM", enabled: 1},
      {name: "LEADERBOARD", enabled: 1},
      {name: "RACECOURSE", enabled: 0}
   ]
};

//! color scheme definitions
const cscheme_ =
[
   {bg: "#171717", cap: "#b0b0b0", xbg: "#b0b0b030", xbgh: "#b0b0b050", bte: "#e0000030", bteh: "#e0000050", tx: "#c0c0c0"},
   {bg: "#e8e8d8", cap: "#404040", xbg: "#000000b0", xbgh: "#000000e0", bte: "#e0000030", bteh: "#e0000050", tx: "#e8e8e8"}
];
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
      C.ctx.lineTo((moments[i].at - C.t_min) * C.sx, (C.d_max - moments[i].dist_tot) * C.sy);
   C.ctx.stroke();

   C.ctx.beginPath();
   C.ctx.moveTo(0, C.d_max * C.sy);
   for (var i = moments.length - 1; i >= 0; i--)
      C.ctx.lineTo((moments[i].at - C.t_min) * C.sx, (C.d_max - moments[i].dmg) * C.sy);
   C.ctx.stroke();
}


/*! Fill the array between the curves "distance sailed" and "distance made
 * good".
 */
function fill_moments(C, moments)
{
   C.ctx.beginPath();
   C.ctx.moveTo(0, C.d_max * C.sy);
   for (var i = moments.length - 1; i >= 0; i--)
      C.ctx.lineTo((moments[i].at - C.t_min) * C.sx, (C.d_max - moments[i].dist_tot) * C.sy);
   for (var i = 0; i < moments.length; i++)
      C.ctx.lineTo((moments[i].at - C.t_min) * C.sx, (C.d_max - moments[i].dmg) * C.sy);
   C.ctx.fill();
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
function caption(C, x, y)
{
   var text = title_.split("\n");
   var w = 0, b = 10;

   for (var i = 0; i < text.length; i++)
      w = Math.max(w, C.ctx.measureText(text[i]).width);
   w += b;

   C.ctx.save();
   C.ctx.translate(x - w / 2, y);
   C.ctx.beginPath();
   C.ctx.fillStyle = col_.xbg;
   C.ctx.rect(0, 0, w, 20 * (text.length + .5));
   C.ctx.fill();

   C.ctx.beginPath();
   C.ctx.fillStyle = col_.tx;
   for (var i = 0; i < text.length; i++)
      C.ctx.fillText(text[i], b / 2, 20 * (i + 1));
  C.ctx.restore();
}


/*! This function draws the buttons and set the coordinates in the button
 * object. The latter is necessary for the mouse_move_handler to detect if a
 * button is hovered over.
 */
function buttons(C, x, y)
{
   const w = BUTTONW, h = BUTTONH;
   const x0 = x - w * G.bt.length / 2;
   const y0 = y;

   C.ctx.save();
   C.ctx.strokeStyle = col_.tx;

   for (var i = 0; i < G.bt.length; i++)
   {
      G.bt[i].x0 = x0 + i * w;
      G.bt[i].y0 = y0;
      G.bt[i].x1 = G.bt[i].x0 + w;
      G.bt[i].y1 = G.bt[i].y0 + h;

      if (G.bt_index == i)
         C.ctx.fillStyle = G.bt[i].enabled ? col_.bteh : col_.xbgh;
      else
         C.ctx.fillStyle = G.bt[i].enabled ? col_.bte : col_.xbg;

      C.ctx.beginPath();
      C.ctx.rect(G.bt[i].x0, G.bt[i].y0, w, h);
      C.ctx.fill();
      C.ctx.stroke();
   }

   C.ctx.fillStyle = col_.tx;
   C.ctx.beginPath();
   for (var i = 0; i < G.bt.length; i++)
   {
      var tm = C.ctx.measureText(G.bt[i].name);
      C.ctx.fillText(G.bt[i].name, G.bt[i].x0 + (w - tm.width) / 2, G.bt[i].y0 + (h + tm.actualBoundingBoxDescent + tm.actualBoundingBoxAscent) / 2 - tm.actualBoundingBoxDescent);
   }
   C.ctx.restore();
}


/*! This function draws a color board just with the colors of the participants.
 */
function colorboard(C, x, y, setup_)
{
   const S = 20;

   x -= S * setup_.teams.length / 2;

   C.ctx.save();
   C.ctx.strokeStyle = col_.tx;

   for (var i = 0; i < setup_.teams.length; i++)
   {
      setup_.teams[i].x0 = x + i * S;
      setup_.teams[i].y0 = y;
      setup_.teams[i].x1 = setup_.teams[i].x0 + S
      setup_.teams[i].y1 = setup_.teams[i].y0 + S;

      if (G.mo_index == i || setup_.teams[i].visible)
         C.ctx.fillStyle = "#" + setup_.teams[i].colour + "e0";
      else
         C.ctx.fillStyle = "#" + setup_.teams[i].colour + "80";

      C.ctx.beginPath();
      C.ctx.rect(setup_.teams[i].x0, setup_.teams[i].y0, S, S);
      C.ctx.fill();
      C.ctx.stroke();
   }

   C.ctx.restore();
}


/*! This function draws the leader board and sets the event coordinates.
 */
function leaderboard(C, x, y, setup_, data_)
{
   var tw = measure_names(C, setup_, data_);

   C.ctx.save();
   C.ctx.fillStyle = col_.xbg;
   C.ctx.beginPath();
   C.ctx.rect(x, y, tw + 20, data_.length * NDIST + 10);
   C.ctx.fill();

   for (var i = 0; i < data_.length; i++)
   {
      setup_.teams[i].x0 = x;
      setup_.teams[i].y0 = y + i * NDIST;
      setup_.teams[i].x1 = setup_.teams[i].x0 + tw;
      setup_.teams[i].y1 = setup_.teams[i].y0 + NDIST;

      if (G.mo_index == i || setup_.teams[i].visible)
      {
         C.ctx.fillStyle = "#" + setup_.teams[i].colour + "ff";
         C.ctx.font = "bold 14px sans-serif";
      }
      else
      {
         C.ctx.fillStyle = "#" + setup_.teams[i].colour + "e0";
         C.ctx.font = "14px sans-serif";
      }

      // FIXME: this should go to calc_data() or similar
      var v_avg = data_[i].moments[0].dist_tot * 3600 / (data_[i].moments[0].at - data_[i].moments[data_[i].moments.length - 1].at);

      C.ctx.beginPath();
      C.ctx.fillText(setup_.teams[i].name + ", dist = " + data_[i].moments[0].dist_tot.toFixed(1) + ", v_avg = " + v_avg.toFixed(2), setup_.teams[i].x0 + 10, setup_.teams[i].y0 + NDIST*0.8);
   }
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

   document.body.style.backgroundColor = col_.bg;
   var canvas = document.getElementById("chart");
   C.ctx = canvas.getContext("2d");
   C.width = canvas.width = window.innerWidth;
   C.height = canvas.height = window.innerHeight;

   C.t_min = setup_.teams[0].start;
   for (var i = 0; i < data_.length; i++)
   {
      C.t_max = Math.max(C.t_max, data_[i].moments[0].at);
      C.d_max = Math.max(C.d_max, data_[i].moments[0].dist_tot);
   }

   var ysplit = 0.8;
   C.sx = C.width / (C.t_max - C.t_min);
   C.sy = C.height / C.d_max * ysplit;
   C.sy2 = C.height / C.v_max * (1 - ysplit);

   C.ctx.lineWidth = 1;
   C.ctx.font = "14px sans-serif";

   C.ctx.save();
   C.ctx.translate(C.width * BORDER, C.height * BORDER);
   C.ctx.scale(1 - BORDER * 2, 1 - BORDER * 2);

   if (G.bt[1].enabled)
      draw_map(C);

   if (G.bt[2].enabled)
      axis(C);

   C.ctx.restore();

   buttons(C, C.width / 2, 20);

   if (G.bt[0].enabled)
      caption(C, C.width / 2, G.bt[3].enabled ? 60 : 95);

   C.ctx.save();
   C.ctx.translate(C.width * BORDER, C.height * BORDER);
   C.ctx.scale(1 - BORDER * 2, 1 - BORDER * 2);

   if (G.bt[4].enabled)
   {
      C.ctx.strokeStyle = "#f000f0";
      C.ctx.setLineDash([6, 3, 2, 3]);
      draw_moments_map(C, setup_.course.nodes);
      C.ctx.setLineDash([]);
   }

   for (var i = 0; i < data_.length; i++)
   {
      if (G.mo_index == i || setup_.teams[i].visible)
         C.ctx.strokeStyle = "#" + setup_.teams[i].colour + "ff";
      else
         C.ctx.strokeStyle = "#" + setup_.teams[i].colour + "e0";
      C.ctx.lineWidth = G.mo_index == i ? 3 : 1;

      if (!setup_.teams[i].visible && G.mo_index != i)
         continue;

      if (G.bt[1].enabled)
         draw_moments_map(C, data_[i].moments);

      if (G.bt[2].enabled)
      {
         draw_moments(C, data_[i].moments);
         C.ctx.fillStyle = "#" + setup_.teams[i].colour + "10";
         fill_moments(C, data_[i].moments);
         draw_marks(C, data_[i].moments);
         draw_v_avg(C, data_[i].moments);
      }
   }
   C.ctx.restore();

   if (G.bt[3].enabled)
      leaderboard(C, TEXTX, 20, setup_, data_);
   else
      colorboard(C, C.width / 2, 60, setup_);
}



// some global variables (_s: RaceSetup, _j: AllPositions3
// FIXME: I hate this, but due to a lack of understanding of the fetch/then
// construction I was yet unable to write this in a proper manner.
var _s, _j;


function match_array_coords(x, y, a)
{
   for (var i = 0; i < a.length; i++)
      if (x >= a[i].x0 && x < a[i].x1 && y >= a[i].y0 && y < a[i].y1)
         return i;
   return -1;
}


/*! This function determines the current mouse position of an event and detects
 * if the mouse is hovered over a participant, and which index it is.
 */
function handle_mouse_pos(e)
{
   var mx = e.pageX - document.getElementById("chart").getBoundingClientRect().left;
   var my = e.pageY - document.getElementById("chart").getBoundingClientRect().top;

   G.mo_index = match_array_coords(mx, my, _s.teams);
   G.bt_index = match_array_coords(mx, my, G.bt);
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
   if (G.mo_index >= 0 && G.mo_index < _s.teams.length)
      _s.teams[G.mo_index].visible ^= 1;
   else if (G.bt_index >= 0)
      G.bt[G.bt_index].enabled ^= 1;
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


/*! This function corrects the timestamps of the VDH track to the current race
 * and adds to track to the ggr2022 race data.
 * FIXME: This code should go into another file since it is GGR-specific.
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
 * FIXME: The subpath "ggr2022" should be replaced by a variable.
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
      data_check(setup, data);
      save_data(setup, data);
      gen_grid();
      calc_chart();
      calc_course(setup.course.nodes);
      prep_vdh(setup, data);
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

