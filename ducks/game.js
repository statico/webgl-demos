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
  SPEED: 0.1,

  defaults: {
    x: -15,
    y: 0,
    rotation: 0,
    targetX: 0,
    targetY: 0
  },

  tick: function() {
    var attr = this.attributes;
    var distance = Trig.distance(attr.x, attr.y, attr.targetX, attr.targetY);
    if (distance <= this.RADIUS) return;
    var angle = Trig.angle(attr.x, attr.y, attr.targetX, attr.targetY);
    var vx = Math.cos(angle) * this.SPEED;
    var vy = Math.sin(angle) * this.SPEED;
    this.set({
      rotation: angle,
      x: attr.x + vx,
      y: attr.y + vy
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

var Game = Backbone.View.extend({

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
    _.each(_.range(this.NUM_DUCKS), function() {
      // TODO - don't place ducks near each other
      var x = Math.random() * (this.RIGHT + -this.LEFT) + this.LEFT;
      var y = Math.random() * (this.TOP + -this.BOTTOM) + this.BOTTOM;
      this.ducks.add({ x: x, y: y });
    }, this);

    var _this = this;
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

    var pattr = this.ship.attributes;
    var max = Ship.RADIUS + Duck.RADIUS;
    this.ducks.each(function(duck) {
      var dattr = duck.attributes;
      var distance = Trig.distance(pattr.x, pattr.y, dattr.x, dattr.y);
      if (distance < max) {
        ducks.remove(duck);
      }
    }, this);

    if (this.ducks.isEmpty()) {
      this.trigger('gameOver');
      clearInterval(this.interval);
    }
  }

});
