/*! This decoder parses the binary track data from the YB race tracker. The
 * data is available at https://cf.yb.tl/BIN/ggr2022/AllPositions3 (e.g. for
 * the GGR2022).
 * \author Bernhard R. Fischer
 */

/* 
   // Original JS decoder used in the web page.
   PositionParser = {
        parse: function(e) {
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
        },
*/

#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <unistd.h>
#include <endian.h>

#define MAX_MOMENTS 4096


typedef struct moment
{
   int dtf;
   double lat, lon;
   unsigned at;
   double pc;     // unknown
   int lap;
   int alt;
} moment_t;


static unsigned getUint8(const char *buf, size_t pos)
{
   return buf[pos];
}


static unsigned getUint16(const char *buf, size_t pos)
{
   return be16toh(*((uint16_t*) &buf[pos]));
}


static unsigned getUint32(const char *buf, size_t pos)
{
   return be32toh(*((uint32_t*) &buf[pos]));
}


static int getInt16(const char *buf, size_t pos)
{
   return (int16_t) be16toh(*((int16_t*) &buf[pos]));
}


static int getInt32(const char *buf, size_t pos)
{
   return be32toh(*((int32_t*) &buf[pos]));
}


void output_positions(int id, const moment_t *m, int v)
{
   printf("   {\n      \"id\": %d,\n      \"moments\": [\n", id);
   for (int i = 0; i < v; i++)
   {
      printf("         {\n            \"dtf\": %d,\n            \"lat\": %.7g,\n            \"lon\": %.7g,\n            \"at\": %d\n         }%s\n",
            m[i].dtf, m[i].lat / 1e5 , m[i].lon / 1e5, m[i].at, i < v - 1 ? "," : "");
   }
   printf("      ]\n   }");
}


int PositionParser(const char *buf, int len)
{
   int a, s, n, r, l, y, M, b, L, x, f;
   unsigned i, o, u, h, v, p, w, T;
   moment_t g, m;
   moment_t d[MAX_MOMENTS];

   memset(d, 0, sizeof(d));

   i = getUint8(buf, 0);
   a = 1 & i;
   s = 2 & i;
   n = 4 & i;
   r = 8 & i;
   o = getUint32(buf, 1);

   printf("[\n");
   for (l = 5; l < len;)
   {
      u = getUint16(buf, l);
      l += 2;
      h = getUint16(buf, l);
      l += 2;

      memset(&g, 0, sizeof(g));
      for (v = 0; v < h; v++)
      {
         // safety check
         if (v >= MAX_MOMENTS) fprintf(stderr, "MAX_MOMENTS too small, increase and recompile!\n"), exit(1);

         p = getUint8(buf, l);
         memset(&m, 0, sizeof(m));
         if (128 & p)
         {
            w = getUint16(buf, l);
            l += 2;
            y = getInt16(buf, l);
            l += 2;
            M = getInt16(buf, l);
            l += 2;
            if (a)   // a && (m.alt = t.getInt16(l)
            {
               m.alt = getInt16(buf, l);
               l += 2;
            }  
            if (s)
            {
               f = getInt16(buf, l);
               l += 2;
               m.dtf = g.dtf + f;
               if (n)   // n && (m.lap = t.getUint8(l)
               {
                  m.lap = getUint8(buf, l);
                  l++;
               }
            }
            if (r)
            {
               m.pc = getInt16(buf, l) / 32e3;
               l += 2;
            }
            w = 32767 & w;
            m.lat = g.lat + y;
            m.lon = g.lon + M;
            m.at = g.at - w;
            m.pc = g.pc + m.pc;
         }
         else
         {
            T = getUint32(buf, l);
            l += 4;
            b = getInt32(buf, l);
            l += 4;
            L = getInt32(buf, l);
            l += 4;
            if (a)
            {
               m.alt = getInt16(buf, l);
               l += 2;
            }
            if (s)
            {
               x = getInt32(buf, l);
               l += 4; 
               m.dtf = x;
               if (n)
               {
                  m.lap = getUint8(buf, l);
                  l++;
               }
            }
            if (r)
            {
               m.pc = getInt32(buf, l) / 21e6;
               l += 4;
            }
            m.lat = b;
            m.lon = L;
            m.at = o + T;
         }
         d[v] = m;
         g = m;
      } // for (g = 0, v = 0; v < h; v++)
      output_positions(u, d, v);
      printf("%s\n", l < len - 1 ? "," : "");
   }
   printf("]\n");

   return 0;
}


int main(int argc, char **argv)
{
   char buf[100000];
   int len;

   len = read(0, buf, sizeof(buf));
   PositionParser(buf, len);

   return 0;
}

