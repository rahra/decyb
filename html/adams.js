const M_PI_2 = Math.PI / 2;
const C1 = 1e-3;
const C2  = 1e-9;
const TOL = 1e-5;
const A2_PHI_SCALE = 2.62181347;
const A2_LAM_SCALE = 2.62205760;


/*! This function calculates the elliptic integral. It is derived from Torben
 * Janson's code (here
 * https://observablehq.com/@toja/adams-world-in-a-square-i-ii) and checked
 * against his implementation literature (citation see below).
 *
 * This is the original remark ab T. Janson:
 * Computes the elliptic integral of the first kind.
 * Algorithm from Bulirsch(1965), the implementation follows Snyder(1989), p. 239.
 * A faster alternative for m = 0.5 is presented in:
 * Gerald I. Evenden (2008), libproj4: A Comprehensive Library of
 * Cartographic Projection Functions (Preliminary Draft), p. 123.
 */
function elliptic_f(phi, m)
{
   var g, h, k, n, p, r, y, sp;

   sp = Math.sin(phi);
   h = sp * sp;
   k = Math.sqrt(1 - m);

   // "complete" elliptic integral
   if (h >= 1 || Math.abs(phi) == M_PI_2)
   {
      if (k <= TOL)
         return sp < 0 ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;

      m = 1;
      h = m;
      m += k;

      while (Math.abs(h - k) > C1 * m)
      {
         k = Math.sqrt(h * k);
         m /= 2;
         h = m;
         m += k;
      }

      return sp < 0 ? -Math.PI / m : Math.PI / m;
   }
   // "incomplete" elliptic integral
   else
   {
      if (k <= TOL)
         return Math.log((1 + sp) / (1 - sp)) / 2;

      y = Math.sqrt((1 - h) / h);
      n = 0;
      m = 1;
      p = m * k;
      g = m;
      m += k;
      y -= p / y;

      if (Math.abs(y) <= 0)
         y = C2 * Math.sqrt(p);

      while (Math.abs(g - k) > C1 * g)
      {
         k = 2 * Math.sqrt(p);
         n += n;
         if (y < 0)
            n += 1;
         p = m * k;
         g = m;
         m += k;
         y -= p / y;

         // FIXME: although this is exactly in the original algorithm by Snyder
         // (1989), it can never be <0, only ==0.
         if (Math.abs(y) <= 0)
            y = C2 * Math.sqrt(p);
      }

      if (y < 0)
         n += 1;

      r = (Math.atan(m / y) + Math.PI * n) / m;
      return sp < 0 ? -r : r;
   }
}


function elliptic_factory(a, b, sm, sn)
{
   var m, n;

   m = Math.asin(Math.sqrt(1 + Math.min(0, Math.cos(a + b))));
   if (sm)
      m = -m;

   n = Math.asin(Math.sqrt(Math.abs(1 - Math.max(0, Math.cos(a - b)))));
   if (sn)
      n = -n;

   return {x: elliptic_f(m, 0.5), y: elliptic_f(n, 0.5)};
}


function adams_square_ii(lambda, phi)
{
   var a, b, sm, sn, sp;
   var xy;

   sp = Math.tan(0.5 * phi);
   a = Math.cos(Math.asin(sp)) * Math.sin(0.5 * lambda);
   sm = (sp + a) < 0;
   sn = (sp - a) < 0;
   b = Math.acos(sp);
   a = Math.acos(a);

   xy = elliptic_factory(a, b, sm, sn);

   return {x: Math.SQRT1_2 * (xy.x - xy.y), y: Math.SQRT1_2 * (xy.x + xy.y)};
}

