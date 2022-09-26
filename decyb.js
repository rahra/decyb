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


function coord_diff(src, dst)
{
   var dlat, dlon;

   dlat = dst.lat - src.lat;
   dlon = (dst.lon - src.lon) * Math.cos(DEG2RAD((src.lat + dst.lat) / 2.0));

   dst.bearing = fmod2(RAD2DEG(Math.atan2(dlon, dlat)));
   dst.dist = 60 * RAD2DEG(Math.acos(
      Math.sin(DEG2RAD(src.lat)) * Math.sin(DEG2RAD(dst.lat)) +
      Math.cos(DEG2RAD(src.lat)) * Math.cos(DEG2RAD(dst.lat)) * Math.cos(DEG2RAD(dst.lon - src.lon))));
}


function calc_moments(moments)
{
   moments[moments.length - 1].td = moments[moments.length - 1].dist = moments[moments.length - 1].dist_tot = 0;
   for (var i = moments.length - 1; i; i--)
   {
      coord_diff(moments[i], moments[i - 1]);
      moments[i - 1].dist_tot = moments[i - 1].dist + moments[i].dist_tot;
      moments[i - 1].td = moments[i - 1].at - moments[i].at;
      moments[i - 1].v_avg = moments[i - 1].dist / moments[i - 1].td * 3600;
      //if (moments[i - 1].v_avg > 12) console.log(moments[i]);
   }
}
 

function calc_data(data_)
{
   for (var i = 0; i < data_.length; i++)
      calc_moments(data_[i].moments);
}


function data_check(setup_, data_)
{
   for (var i = 0; i < data_.length; i++)
      if (data_[i].id != setup_.teams[i].id)
         console.log(data_[i].id + " != " + setup_.teams[i].id);
}


function draw_v_avg(ctx, moments, t_min, v_max, sy)
{
      ctx.beginPath();
      ctx.moveTo(0, v_max * sy);
      for (var i = moments.length - 1; i >= 0; i--)
            ctx.lineTo((moments[i].at - t_min) * sx, (v_max - moments[i].v_avg) * sy);
      ctx.stroke();
}



function draw_moments(ctx, moments, t_min, d_max)
{
      ctx.beginPath();
      ctx.moveTo(0, d_max * sy);
      for (var i = moments.length - 1; i >= 0; i--)
            ctx.lineTo((moments[i].at - t_min) * sx, (d_max - moments[i].dist_tot) * sy);
      ctx.stroke();
}


function draw_data(setup_, data_)
{
   data_check(setup_, data_);

   document.body.style.backgroundColor = "#171717";
   var canvas = document.getElementById("chart");
   var ctx = canvas.getContext("2d");
   canvas.width = window.innerWidth * 0.95;
   canvas.height = window.innerHeight * 0.95;

   var t_min = Math.floor(Date.now() / 1000);
   //var t_min = 1662300000;
   var t_max = 0;
   var d_max = 0;
   for (var i = 0; i < data_.length; i++)
   {
      t_min = Math.min(t_min, data_[i].moments[data_[i].moments.length - 1].at);
      t_max = Math.max(t_max, data_[i].moments[0].at);
      d_max = Math.max(d_max, data_[i].moments[0].dist_tot);
   }

   //ctx.scale(canvas.width / (t_max - t_min), canvas.height / d_max);
   sx = canvas.width / (t_max - t_min);
   sy = canvas.height / d_max;
   ctx.lineWidth = 2;
   ctx.font = "14px sans-serif";

   for (var i = 0; i < data_.length; i++)
   {
      //if (data_[i].id != 3) continue;
      ctx.strokeStyle = "#" + setup_.teams[i].colour;
      ctx.fillStyle = "#" + setup_.teams[i].colour;
      draw_moments(ctx, data_[i].moments, t_min, d_max);
      draw_v_avg(ctx, data_[i].moments, t_min, 20, canvas.height / 20);
      var v_avg = data_[i].moments[0].dist_tot * 3600 / (data_[i].moments[0].at - data_[i].moments[data_[i].moments.length - 1].at);
      ctx.fillText("(" + i + ") " + setup_.teams[i].name + ", dist = " + data_[i].moments[0].dist_tot.toFixed(1) + ", v_avg = " + v_avg.toFixed(2), 50, (i+1) * 15);
   }
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

         calc_data(jdata);
         //document.getElementById("pre").innerHTML = JSON.stringify(jdata, null, 2);
         draw_data(setup, jdata);
      })
   });
}

