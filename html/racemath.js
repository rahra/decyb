/*! This file contains the code for all race calculations. It's moved from
 * decyb/math.js and slightly modified to be OO.
 *
 * \file racemath.js
 * \author Bernhard R. Fischer <bf@abenteuerland.at>
 * \date 2023/09/15
 */


class CMath
{
   static name = "cmath";


   static DEG2RAD(d)
   {
      return d * Math.PI / 180;
   }


   static RAD2DEG(r)
   {
      return r * 180 / Math.PI;
   }


   static fmod2(a)
   {
      for (; a >= 360; a -= 360);
      for (; a < 0; a += 360);
      return a;
   }


   /*! Calculate the orthodrome distance between to geographic coordinates src and
    * dst defined by latitude and longitude. The result is stored as distance in
    * nautical miles and bearing in degrees dst2.
    */
   static coord_diff0(src, dst, dst2)
   {
      var dlat, dlon;

      // handle corner case if src == dst
      if (src.lat == dst.lat && src.lon == dst.lon)
      {
         dst2.bearing = 0;
         dst2.dist = 0;
         return;
      }

      dlat = dst.lat - src.lat;
      dlon = (dst.lon - src.lon) * Math.cos(CMath.DEG2RAD((src.lat + dst.lat) / 2.0));

      dst2.bearing = CMath.fmod2(CMath.RAD2DEG(Math.atan2(dlon, dlat)));
      dst2.dist = 60 * CMath.RAD2DEG(Math.acos(
         Math.sin(CMath.DEG2RAD(src.lat)) * Math.sin(CMath.DEG2RAD(dst.lat)) +
         Math.cos(CMath.DEG2RAD(src.lat)) * Math.cos(CMath.DEG2RAD(dst.lat)) * Math.cos(CMath.DEG2RAD(dst.lon - src.lon))));
   }


   /*! This is a wrapper function for coord_diff0(). It stores the result directly
    * into dst.
    */
   static coord_diff(src, dst)
   {
      CMath.coord_diff0(src, dst, dst);
   }
}


class RaceMath
{
   /*! This function eliminates moments which happen in the future (according to
    * the timestamp) or which occured before the start of the race.
    */
   static clean_moments(moments, t_min, t_max)
   {
      // remove elements before the start
      for (; moments.slice(-1)[0].at < t_min;)
         moments.pop();
      // remove elements which are in the future
      for (; moments[0].at > t_max;)
         moments.shift();
   }


   /*! This function calculates the distance and bearing of the basic intend
    * course to go. The track points are ordered ascendingly in the RaceSetup
    * data.
    */
   static calc_course(moments)
   {
      var dst = {bearing: 0, dist: 0};
      moments[0].dist = moments[0].dist_tot = moments[0].bearing = 0;
      for (var i = 0; i < moments.length - 1; i++)
      {
         CMath.coord_diff0(moments[i], moments[i + 1], dst);
         moments[i].bearing = dst.bearing;
         moments[i + 1].dist = dst.dist;
         moments[i + 1].dist_tot = moments[i].dist_tot + dst.dist;
      }
      return moments.length > 0 ? moments[moments.length - 1].dist_tot : 0;
   }


   /*! Calculate the difference between 2 bearings (0 - 360).
    * @return The function always returns a value -180 <= v <= 180.
    */
   static diff_bearing(bear_mom, bear_course)
   {
      var b = bear_mom - bear_course;
      return b > 180 ? b - 360 : b;
   }


   /*! The function calculates if a bearing calculate from a moment does not
    * deviate more than 90 degrees to starboard (+90) or portside (-90).
    */
   static coursepoint_in_sight(bear_mom, bear_course)
   {
      var v = RaceMath.diff_bearing(bear_mom, bear_course);
      return v < 90 && v > -90;
   }


   /*! This function calculates the DMG and the DTF for every moment of a
    * participant's track.
    */
   static calc_dtf(moments, course)
   {
      var dist_tot = course[course.length - 1].dist_tot;
      var dst = {};
      var i = moments.length - 1;
      // Loop over all course points, starting with 2nd course point to avoid special corner case at the beginning of the ggr2022.
      for (var j = 1; j < course.length && i < moments.length; j++)
      {
         for (; i >= 0; i--)
         {
            CMath.coord_diff0(moments[i], course[j], dst);
            if (!RaceMath.coursepoint_in_sight(dst.bearing, course[j].bearing))
               break;
            moments[i].dtf = dist_tot - course[j].dist_tot + dst.dist;
            moments[i].dmg = course[j].dist_tot - dst.dist;
            /* just debugging
            moments[i].d_j = j;
            moments[i].d_b = diff_bearing(dst.bearing, course[j].bearing);
            moments[i].d_dist = dst.dist;
            moments[i].d_b2c = dst.bearing;
            moments[i].d_cb = course[j].bearing; */
         }
      }
   }


   /* This function does some initial calculations in the track data. It
    * calculates the distance, the total distance, the bearing, and the average
    * speed for each track point, and it finds the point with the highest average
    * speed.
    * The trackpoints are ordered descendingly, so the latest point in time is the
    * first point in the arrays.
    *
    * @param moments Array of moments in descending time order.
    * @param min_avg Optional. Average speeds between moments below this value
    * are not considered as movement. The default value is 0 which means that
    * all values are considered. This may be useful if there are intermediate
    * stops which should not used in the total average calculation.
    * @return Returns the total number of seconds which the boat was in
    * movement.
    */
   static calc_moments(moments, min_avg = 0)
   {
      var ix = -1, v_avg = 0, t_move = 0;

      // set distance of 1st point to 0
      moments[moments.length - 1].td = moments[moments.length - 1].dist = moments[moments.length - 1].dist_tot = 0;
      for (var i = moments.length - 1; i; i--)
      {
         CMath.coord_diff(moments[i], moments[i - 1]);
         moments[i - 1].dist_tot = moments[i - 1].dist + moments[i].dist_tot;

         moments[i - 1].td = moments[i - 1].at - moments[i].at;
         moments[i - 1].v_avg = moments[i - 1].td ? moments[i - 1].dist / moments[i - 1].td * 3600 : 0;

         // find max avg speed
         if (moments[i - 1].v_avg > v_avg)
         {
            v_avg = moments[i - 1].v_avg;
            ix = i - 1;
         }

         // calculate time of movement
         if (moments[i - 1].v_avg >= min_avg)
            t_move += moments[i - 1].td;
      }

      if (ix == -1)
         return 0;

      // set max speed
      moments[ix].v_avg_max = 1;
      return t_move;
   }


   /*! This function calculates of a is approximately b with a deviation of not
    * more than p percent. If p == 0, a and b must match exactly.
    */
   static approx(a, b, p)
   {
      if (a < b * (1 - p) || a > b * (1 + p))
         return a - b;
      return 0;
   }


   /*! Calculate distances over time t for all moments.
    */
   static calc_tdist(moments, t, p = 0.01)
   {
      var dist, td, l, d;

      for (var i = moments.length - 1; i > 1; i--)
      {
         dist = 0;
         td = moments[i].at;
         for (var j = i - 1; j > 0; j--)
         {
            d = moments[j].at - moments[i].at;

            if (d > t)
            {
               // make sure calculated value matches approximately expected value
               if (RaceMath.approx(td, t, p) != 0)
                  break;

               j--;
               // add data array of it does not exist yet
               if (!moments[j].hasOwnProperty("dist_t"))
                  moments[j].dist_t = [];

               // check if element with similar value already exists
               for (l = 0; l < moments[j].dist_t.length; l++)
               {
                  if (moments[j].dist_t[l].t_exp == t)
                  {
                     // overwrite data if new data is more accurate
                     if (moments[j].dist_t[l].t < td)
                     {
                        moments[j].dist_t[l].t = td;
                        moments[j].dist_t[l].dist = dist;
                        moments[j].dist_t[l].v_avg = dist / (td / 3600);
                     }
                     break;
                  }
               }

               // push new data to array if it does not exist yet
               if (l >= moments[j].dist_t.length)
                  moments[j].dist_t.push({"t": td, "t_exp": t, "dist": dist, "v_avg": dist / (td / 3600)});
               break;
            }

            // keep current values for next iteration
            td = d;
            dist += moments[j].dist;
         }
      }
   }
}

// export module
if(typeof module !== 'undefined')
   module.exports = RaceMath;

