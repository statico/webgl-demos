/*!
 * Models for the Ducks game.
 *
 * Requires: Backbone, Underscore.js.
 *
 * I'm using Backbone because it's got a simple, useful way to subscribe to
 * data events. I'm not sure how well it would scale to a full game, though,
 * with hundreds of events to closures being called every frame.
 */

/* Handy trig functions. */
var Trig = {
    deg2rad: function(deg) {
      return deg * Math.PI / 180;
    },
    rad2deg: function(rad) {
      return rad * 180 / Math.PI;
    },
    distance: function(x1, y1, x2, y2) {
      return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2));
    },
    angle: function(x1, y1, x2, y2) {
      return Math.atan2(y2 - y1, x2 - x1);
    },
    angleDeg: function(x1, y1, x2, y2) {
      return Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    }
};

var Ship = Backbone.Model.extend({

  RADIUS: 1,
  FORWARD_THRUST: 0.3,
  MAX_TURN_SPEED: 3,

  defaults: {
    x: -15,
    y: 0,
    vx: 0,
    vy: 0,
    dir: 0,
    targetX: 0,
    targetY: 0
  },

  tick: function() {
    var old = this.attributes;

    // Calculate the new heading. Don't let the ship turn faster than
    // TURN_SPEED.
    //
    // There are smarter solutions for turrent rotation involving dot products
    // and cross products, but I'm going to go with the simple solution:
    // http://stackoverflow.com/questions/1048945
    var M = this.MAX_TURN_SPEED;
    var dir = Trig.angleDeg(old.x, old.y, old.targetX, old.targetY);
    var delta = Math.abs(old.dir - dir);
    if (delta > M * 3) {
      if (dir > old.dir) {
        if (dir - old.dir < 180) {
          dir = old.dir + M;
        } else {
          dir = old.dir - M;
        }
      } else if (dir < old.dir) {
        if (old.dir - dir < 180) {
          dir = old.dir - M;
        } else {
          dir = old.dir + M;
        }
      }
    }

    var vx = Math.cos(Trig.deg2rad(dir)) * this.FORWARD_THRUST;
    var vy = Math.sin(Trig.deg2rad(dir)) * this.FORWARD_THRUST;

    this.set({
      delta: delta,
      dir: dir % 360,
      vx: vx,
      vy: vy,
      x: old.x + vx,
      y: old.y + vy
    });
  }

});

var Duck = Backbone.Model.extend({

  RADIUS: 1,

  defaults: {
    x: 0,
    y: 0
  }

});

var DuckCollection = Backbone.Collection.extend({
  model: Duck
});

var GameController = Backbone.View.extend({

  FRAME_RATE: 30,
  NUM_DUCKS: 12,

  LEFT: -15,
  RIGHT: 10,
  TOP: 5,
  BOTTOM: -5,

  initialize: function() {
    this.ship = new Ship();
    this.ducks = new DuckCollection();
  },

  start: function() {
    var _this = this;

    var x, y;
    var MIN_DISTANCE = Duck.prototype.RADIUS * 3;
    var isTooClose = function(other) {
      var o = other.attributes;
      var distance = Trig.distance(x, y, o.x, o.y);
      return distance < MIN_DISTANCE;
    };
    _.each(_.range(this.NUM_DUCKS), function() {
      var tries = 0;
      while (tries < 30) {
        x = Math.random() * (this.RIGHT + -this.LEFT) + this.LEFT;
        y = Math.random() * (this.TOP + -this.BOTTOM) + this.BOTTOM;
        if (!this.ducks.any(isTooClose)) break;
        tries++;
      }
      this.ducks.add({ x: x, y: y });
    }, this);

    clearInterval(this.interval);
    this.interval = setInterval(function() {
      _this.tick();
    }, 1000 / this.FRAME_RATE);
  },

  setTarget: function(x, y) {
    this.ship.set({
      targetX: x,
      targetY: y
    });
  },

  tick: function() {
    this.ship.tick();

    var sa = this.ship.attributes;
    var max = Ship.prototype.RADIUS + Duck.prototype.RADIUS;
    this.ducks.each(function(duck) {
      var da = duck.attributes;
      var distance = Trig.distance(sa.x, sa.y, da.x, da.y);
      if (distance < max) {
        this.ducks.remove(duck);
      }
    }, this);

    if (this.ducks.isEmpty()) {
      this.trigger('gameOver');
      clearInterval(this.interval);
    }
  }

});
