/*! Command line option parser.
 *
 * \author Bernhard R. Fischer, <bf@abenteuerland.at>
 * \date 2023/09/18
 */

const proc = require("process");


class GetOpts
{
   static get OARG(){return 0;}
   static get OSHORT(){return 1;}
   static get OLONG(){return 3;}
   static get OEND(){return 2;}


   constructor()
   {
      this.optar = [];
      this.init();
   }


   getoptarray()
   {
      return this.optar;
   }


   getarg(n)
   {
      var j = 0;
      for (var i = 0; i < this.optar.length; i++)
         if (this.optar[i].type == "arg")
         {
            if (j == n)
               return this.optar[i];
            j++;
         }
      return this.optar.push({"type": "arg", "value": undefined});
   }


   getopt(opt)
   {
      return this.optar.find(function(p){return p.name == this && p.type == "opt" && p}, opt);
   }


   init()
   {
      for (var i = 2; i < proc.argv.length; i++)
      {
         // end of option list found
         if (this.option_type(proc.argv[i]) == GetOpts.OEND)
         {
            for (var j = i + 1; j < proc.argv.length; j++)
               this.optar.push({"type": "arg", "value": proc.argv[j]});
            break;
         }

         // check for long options
         if (this.option_type(proc.argv[i]) == GetOpts.OLONG)
         {
            
            var x = proc.argv[i].indexOf("=");
            if (x == -1)
               this.optar.push({"type": "opt", "name": proc.argv[i].substring(2), "value": true});
            else
               this.optar.push({"type": "opt", "name": proc.argv[i].substring(2, x), "value": proc.argv[i].substring(x)});
            continue;
         }

         // check for short options
         if (this.option_type(proc.argv[i]) == GetOpts.OSHORT)
         {
            // several combined options in one string
            if (proc.argv[i].length > 2)
            {
               for (var j = 1; j < proc.argv[i].length; j++)
                  this.add_short_option(proc.argv[i][j]);
               continue;
            }

            // last element in argv array
            if (i >= proc.argv.length - 1)
               this.add_short_option(proc.argv[i][1]);
            // short option with value
            else if (this.option_type(proc.argv[i + 1]) == GetOpts.OARG)
               this.optar.push({"type": "opt", "name": proc.argv[i][1], "value": proc.argv[++i]});
            // boolean short option
            else
               this.add_short_option(proc.argv[i][1]);
            continue;
         }

         // regular arguments
         this.optar.push({"type": "arg", "value": proc.argv[i]});
      }

      return this.optar;
   }


   add_short_option(o)
   {
      var q = this.getopt(this.optar, o);
      if (q === undefined)
         this.optar.push({"type": "opt", "name": o, "value": true, "count": 1});
      else
         q.count++;
   }


   option_type(s)
   {
      if (s == "--")
         return GetOpts.OEND;
      if (/^--/.test(s))
         return GetOpts.OLONG;
      if (/^-/.test(s) && s.length > 1)
         return GetOpts.OSHORT;
      return GetOpts.OARG;
   }
}


// export module
if(typeof module !== undefined)
   module.exports = GetOpts;

