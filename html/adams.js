/*! This file contains the code for the Adams Square II projection.
 * I took it directly from my chart renderer "Smrender"
 * (https://github.com/rahra/smrender) and translated it back from C to JS.
 * Originally, I ported the code from Torben Janson (see below) to C to include
 * it in Smrender.
 * Thanks again to Torben for his effort then!
 *
 * \file adams.js
 * \author Bernhard R. Fischer <bf@abenteuerland.at>
 * \date 2026/09/14
 */

const M_PI = Math.PI;
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


function limit(a, b)
{
   if (a < -b)
      return -b;

   if (a > b)
      return b;

   return a;
}

function inverse(x, y, lam, phi, proj)
{
   var lam2, phi2, dlam0, dphi0, det;
   var dlam = {x: 0, y: 0}, dphi = {x: 0, y: 0}, appr = {x: 0, y: 0}, d = {x: 0, y: 0}, xy2 = {x: 0, y: 0}, dtlam = {x: 0, y: 0}, dtphi = {x: 0, y: 0};

   dlam.x = dlam.y = 0;
   dphi.x = dphi.y = 0;

   for (var i = 0; i < 15; i++)
   {
      appr = proj(lam, phi);
      d.x = appr.x - x;
      d.y = appr.y - y;

      if (Math.abs(d.x) < 1e-10 && Math.abs(d.y) < 1e-10)
         return {x: lam, y: phi};

      if (Math.abs(d.x) > 1e-6 || Math.abs(d.y) > 1e-6)
      {
         dlam0 = lam > 0 ? -1e-6 : 1e-6;
         lam2 = lam + dlam0;
         phi2 = phi;
         xy2 = proj(lam2, phi2);
         dtlam.x = (xy2.x - appr.x) / dlam0;
         dtlam.y = (xy2.y - appr.y) / dlam0;

         dphi0 = phi > 0 ? -1e-6 : 1e-6;
         lam2 = lam;
         phi2 = phi + dphi0;
         xy2 = proj(lam2, phi2);
         dtphi.x = (xy2.x - appr.x) / dphi0;
         dtphi.y = (xy2.y - appr.y) / dphi0;

         det = dtlam.x * dtphi.y - dtphi.x * dtlam.y;
         if (det != 0)
         {
            dlam.x =  dtphi.y / det;
            dlam.y = -dtphi.x / det;
            dphi.x = -dtlam.y / det;
            dphi.y =  dtlam.x / det;
         }
      }

      if (x != 0)
      {
         dlam0 = Math.max(Math.min(d.x * dlam.x + d.y * dlam.y, 0.3), -0.3);
         lam -= dlam0;
         lam = limit(lam, M_PI);
      }

      if (y != 0)
      {
         dphi0 = Math.max(Math.min(d.x * dphi.x + d.y * dphi.y, 0.3), -0.3);
         phi -= dphi0;
         phi = limit(phi, M_PI_2);
      }
   }

   return {x: lam, y: phi};
}


function adams_square_ii_invert(x, y)
{
   var phi, lam;

   phi = Math.max(Math.min(y / A2_PHI_SCALE, 1), -1) * M_PI_2;
   lam = Math.abs(phi) < M_PI ? Math.max(Math.min(x / A2_LAM_SCALE / Math.cos(phi), 1), -1) * M_PI : 0;

   return inverse(x, y, lam, phi, adams_square_ii);
}

