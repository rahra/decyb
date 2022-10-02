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
#include <sys/stat.h>
#include <fcntl.h>


typedef struct moment
{
   int dtf;
   double lat, lon;
   unsigned at;
   double pc;     // unknown
   int lap;
   int alt;
} moment_t;


static unsigned getUint8(const char *buf, int pos)
{
   return buf[pos];
}


static unsigned readUint8(const char *buf, int *pos)
{
   return buf[(*pos)++];
}


static unsigned readUint16(const char *buf, int *pos)
{
   unsigned r = be16toh(*((uint16_t*) &buf[*pos]));
   *pos += 2;
   return r;
}


static unsigned readUint32(const char *buf, int *pos)
{
   unsigned r = be32toh(*((uint32_t*) &buf[*pos]));
   *pos += 4;
   return r;
}


static int readInt16(const char *buf, int *pos)
{
   int16_t r = be16toh(*((int16_t*) &buf[*pos]));
   *pos += 2;
   return r;
}


static int readInt32(const char *buf, int *pos)
{
   int r = be32toh(*((int32_t*) &buf[*pos]));
   *pos += 4;
   return r;
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
   moment_t g, m, *d;

   l = 0;
   i = readUint8(buf, &l);
   a = 1 & i;
   s = 2 & i;
   n = 4 & i;
   r = 8 & i;
   o = readUint32(buf, &l);

   printf("[\n");
   for (; l < len;)
   {
      u = readUint16(buf, &l);
      h = readUint16(buf, &l);

      if ((d = calloc(h, sizeof(*d))) == NULL)
         perror("calloc():"), exit(1);

      memset(&g, 0, sizeof(g));
      for (v = 0; v < h; v++)
      {
         memset(&m, 0, sizeof(m));
         p = getUint8(buf, l);
         if (128 & p)
         {
            w = readUint16(buf, &l);
            y = readInt16(buf, &l);
            M = readInt16(buf, &l);

            if (a)
               m.alt = readInt16(buf, &l);

            if (s)
            {
               f = readInt16(buf, &l);
               m.dtf = g.dtf + f;

               if (n)
                  m.lap = readUint8(buf, &l);
            }

            if (r)
               m.pc = readInt16(buf, &l) / 32e3;

            w = 32767 & w;
            m.lat = g.lat + y;
            m.lon = g.lon + M;
            m.at = g.at - w;
            m.pc = g.pc + m.pc;
         }
         else
         {
            T = readUint32(buf, &l);
            b = readInt32(buf, &l);
            L = readInt32(buf, &l);

            if (a)
               m.alt = readInt16(buf, &l);

            if (s)
            {
               x = readInt32(buf, &l);
               m.dtf = x;

               if (n)
                  m.lap = readUint8(buf, &l);
            }

            if (r)
               m.pc = readInt32(buf, &l) / 21e6;

            m.lat = b;
            m.lon = L;
            m.at = o + T;
         }
         d[v] = m;
         g = m;
      } // for (v = 0; v < h; v++)

      output_positions(u, d, v);
      printf("%s\n", l < len - 1 ? "," : "");

      free(d);
   }
   printf("]\n");

   return 0;
}


#define BLOCKSIZE 65536

int main(int argc, char **argv)
{
   char *buf;
   int fd = 0, len, rlen;

   if (argc > 1 && (fd = open(argv[1], O_RDONLY)) == -1)
      perror("open() failed"), exit(1);

   for (buf = NULL, len = 0, rlen = 1; rlen;)
   {
      if ((buf = realloc(buf, len + BLOCKSIZE)) == NULL)
         perror("realloc() failed"), exit(1);

      if ((rlen = read(fd, &buf[len], BLOCKSIZE)) == -1)
         perror("read(0) failed"), exit(1);

      len += rlen;
   }

   PositionParser(buf, len);
   free(buf);
   close(fd);

   return 0;
}

