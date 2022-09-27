const NDIST = 20;
const TEXTX = 80;
const BORDER = 0.025;

const cscheme_ = [{bg: "#171717", cap: "#b0b0b0", xbg: "#b0b0b030", tx: "#c0c0c0"}, {bg: "#e8e8d8", cap: "#404040", xbg: "#000000b0", tx: "#e8e8e8"}];
var cur_scheme_ = 0;
var col_ = cscheme_[cur_scheme_];


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


function coord_diff(src, dst)
{
   coord_diff0(src, dst, dst);
}


function calc_poi(moments)
{
   for (var j = 0; j < nodes_.length; j++)
   {
      var d = {};
      var dist = 100000;
      var ix = moments.length;
      for (var i = 0; i < moments.length; i++)
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
 

function calc_data(setup_, data_)
{
   for (var i = 0; i < data_.length; i++)
   {
      setup_.teams[i].visible = 0;
      calc_moments(data_[i].moments, setup_.teams[i].start);
      calc_poi(data_[i].moments);
   }
}


function data_check(setup_, data_)
{
   for (var i = 0; i < data_.length; i++)
      if (data_[i].id != setup_.teams[i].id)
         console.log(data_[i].id + " != " + setup_.teams[i].id);
}


function draw_v_avg(ctx, C, moments, setup)
{
   var ix = -1;

   ctx.save();
   ctx.translate(0, C.d_max * C.sy);
   ctx.beginPath();
   ctx.moveTo(0, C.v_max * C.sy2);
   for (var i = moments.length - 1; i >= 0; i--)
   {
      ctx.lineTo((moments[i].at - C.t_min) * C.sx, (C.v_max - moments[i].v_avg) * C.sy2);
      if (moments[i].hasOwnProperty("v_avg_max"))
         ix = i;
   }
   ctx.stroke();

   if (ix >= 0)
   {
      //ctx.strokeStyle = "#f00000";
      ctx.fillStyle = "#f00000";
      ctx.beginPath();
      ctx.arc((moments[ix].at - C.t_min) * C.sx, (C.v_max - moments[ix].v_avg) * C.sy2, 3, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillText("v_avg_max = " + moments[ix].v_avg.toFixed(1), (moments[ix].at - C.t_min) * C.sx, (C.v_max - moments[ix].v_avg) * C.sy2 - 3);
   }
   ctx.restore();
}


function draw_moments(ctx, C, moments)
{
   ctx.beginPath();
   ctx.moveTo(0, C.d_max * C.sy);
   for (var i = moments.length - 1; i >= 0; i--)
   {
      // ignore everything before race start
      if (moments[i].at < C.t_min)
         continue;

      ctx.lineTo((moments[i].at - C.t_min) * C.sx, (C.d_max - moments[i].dist_tot) * C.sy);
   }
   ctx.stroke();
}


function draw_marks(ctx, C, moments)
{
   var AR = 4;
   ctx.save();
   ctx.fillStyle = "#d00000";
   ctx.beginPath();
   for (var i = moments.length - 1; i >= 0; i--)
      if (moments[i].hasOwnProperty("name"))
      {
         ctx.arc((moments[i].at - C.t_min) * C.sx, (C.d_max - moments[i].dist_tot) * C.sy, AR, 0, 2 * Math.PI);
         ctx.fillText(moments[i].name, (moments[i].at - C.t_min) * C.sx, (C.d_max - moments[i].dist_tot) * C.sy - AR);
      }
   ctx.fill();
   ctx.restore();
}


function caption(ctx, C)
{
   var text = title_.split("\n");
   var w = 0;

   for (var i = 0; i < text.length; i++)
      w = Math.max(w, ctx.measureText(text[i]).width);

   ctx.save();
   ctx.beginPath();
   ctx.fillStyle = col_.xbg;
   ctx.rect((C.t_max - C.t_min) * C.sx * 0.33 - 5, 0, w + 10, 20 * (text.length + .5));
   ctx.fill();

   ctx.beginPath();
   ctx.fillStyle = col_.tx;
   for (var i = 0; i < text.length; i++)
      ctx.fillText(text[i], (C.t_max - C.t_min) * C.sx * 0.33, 20 * (i + 1));
  ctx.restore();
}


function axis(ctx, C)
{
   const XDIFF = 20;
   const YDIFF = 20;

   ctx.save();
   ctx.fillStyle = col_.cap;
   ctx.strokeStyle = col_.cap;
   ctx.lineWidth = 1;
   ctx.setLineDash([6,4]);

   // x axis
   ctx.save();
   ctx.translate(0, C.d_max * C.sy);
   var t_diff = (C.t_max - C.t_min) / XDIFF;
   for (var t = C.t_min, td = new Date(); t < C.t_max ; t += t_diff)
   {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -C.d_max * C.sy);
      ctx.stroke();
      td.setTime(t * 1000);
      ctx.save();
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(td.toUTCString(), 30, 0);
      ctx.restore();
      ctx.translate(t_diff * C.sx, 0);
   }
   ctx.restore();

   ctx.save();
   ctx.translate(0, C.d_max * C.sy);
   var d_diff = C.d_max / YDIFF;
   for (var d = 0; d < C.d_max; d += d_diff)
   {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo((C.t_max - C.t_min) * C.sx, 0);
      ctx.stroke();
      var ds = d.toFixed(0) + " nm";
      ctx.fillText(ds, 0, 0);
      ctx.translate(0, -d_diff * C.sy);
   }
   ctx.restore();

   ctx.save();
   ctx.translate(0, C.d_max * C.sy + C.v_max * C.sy2);
   var v_diff = C.v_max / 10;
   for (var v = 0; v < C.v_max; v += v_diff)
   {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo((C.t_max - C.t_min) * C.sx, 0);
      ctx.stroke();
      var vs = v.toFixed(0) + " kts";
      ctx.fillText(vs, 0, 0);
      ctx.translate(0, -v_diff * C.sy2);
   }
   ctx.restore();

   ctx.restore();
}


function draw_data(setup_, data_)
{
   //data_check(setup_, data_);
   document.body.style.backgroundColor = col_.bg;
   var canvas = document.getElementById("chart");
   var ctx = canvas.getContext("2d");
   var width = canvas.width = window.innerWidth;
   var height = canvas.height = window.innerHeight;

   ctx.translate(width * BORDER, height * BORDER);
   //ctx.scale(0.95, 0.95);

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
      };

   C.t_min = setup_.teams[0].start;
   for (var i = 0; i < data_.length; i++)
   {
      //C.t_min = Math.min(C.t_min, data_[i].moments[data_[i].moments.length - 1].at);
      C.t_max = Math.max(C.t_max, data_[i].moments[0].at);
      C.d_max = Math.max(C.d_max, data_[i].moments[0].dist_tot);
   }

   var ysplit = 0.8;
   C.sx = width / (C.t_max - C.t_min) * (1 - 2 * BORDER);
   C.sy = height / C.d_max * ysplit * (1 - 2 * BORDER);
   C.sy2 = height / C.v_max * (1 - ysplit) * (1 - 2 * BORDER);

   ctx.lineWidth = 1;
   ctx.font = "14px sans-serif";

   axis(ctx, C);
   caption(ctx, C);

   ctx.fillStyle = col_.xbg;
   ctx.rect(TEXTX - 10, 0, 370, data_.length * NDIST + 10);
   ctx.fill();

   for (var i = 0; i < data_.length; i++)
   {
      //if (data_[i].id != 3) continue;
      if (_a == i || setup_.teams[i].visible)
      {
         o = "ff";
         ctx.lineWidth = 3;
         ctx.font = "bold 14px sans-serif";
      }
      else
      {
         o = "e0";
         ctx.lineWidth = 1;
         ctx.font = "14px sans-serif";
      }
      ctx.strokeStyle = "#" + setup_.teams[i].colour + o;
      ctx.fillStyle = "#" + setup_.teams[i].colour + o;

      var v_avg = data_[i].moments[0].dist_tot * 3600 / (data_[i].moments[0].at - data_[i].moments[data_[i].moments.length - 1].at);
      ctx.fillText(setup_.teams[i].name + ", dist = " + data_[i].moments[0].dist_tot.toFixed(1) + ", v_avg = " + v_avg.toFixed(2), TEXTX, (i+1) * NDIST);

      if (!setup_.teams[i].visible && _a != i)
         continue;

      draw_moments(ctx, C, data_[i].moments);
      draw_marks(ctx, C, data_[i].moments);
      draw_v_avg(ctx, C, data_[i].moments);
   }
}


var _s, _j, _a = -1;

function handle_mouse_pos(e)
{
   var mx = e.pageX - document.getElementById("chart").getBoundingClientRect().left;
   var my = e.pageY - document.getElementById("chart").getBoundingClientRect().top;

   var x = window.innerWidth * BORDER;
   var y = window.innerHeight * BORDER;
   _a = mx >= x + TEXTX && mx < x + TEXTX + 350 && my >= y && my < _j.length * NDIST + y ? Math.floor((my - y) / NDIST) : -1;
}

function mouse_move_handler(e)
{
   handle_mouse_pos(e);
   update_graph();
}

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


function save_data(setup, jdata)
{
   _s = setup;
   _j = jdata;
}


function update_graph()
{
   draw_data(_s, _j);
}


function get_data(server)
{
   fetch('https://' + server + '/JSON/ggr2022/RaceSetup')
   .then((response) => response.json())
   .then((setup) => {
      fetch('https://' + server + '/BIN/ggr2022/AllPositions3')
      .then((response) => response.arrayBuffer())
      .then((data) => {
         var jdata = parse(data);
         //console.log(jdata);
         //console.log(setup);

         save_data(setup, jdata);
         calc_data(setup, jdata);
         //document.getElementById("pre").innerHTML = JSON.stringify(jdata, null, 2);
         //draw_data(setup, jdata);
         update_graph();
      })
   });
}

