/*!
 * Ducks Game UI.
 *
 * Requires: jQuery
 */

// Utilities
// =========

// requestAnimFrame() via Paul Irish
window.requestAnimFrame = (function(){
  return  window.requestAnimationFrame ||
  window.webkitRequestAnimationFrame ||
  window.mozRequestAnimationFrame    ||
  window.oRequestAnimationFrame      ||
  window.msRequestAnimationFrame     ||
  function( callback ){
    window.setTimeout(callback, 1000 / 60);
  };
})();

// Audio
// =====

var soundfx = new Jukebox({
  resources: [
    'assets/soundfx.mp3',
    'assets/soundfx.ogg'
  ],
  spritemap: {
    pickup: {
      start: 0.00,
      end: 1.47,
      loop: false
    }
  }
});
soundfx.setVolume(0.7);

var music = new Jukebox({
  resources: [
    'assets/DST-Canopy.mp3',
    'assets/DST-Canopy.ogg'
  ],
  loop: true,
  spritemap: {
    track1: {
      start: 0.00,
      end: 63.94,
      loop: true
    }
  }
});
music.setVolume(0.5);

window.soundfx = soundfx; //XXX
window.music = music; //XXX

// Asset system
// ============
//
// Because GLGE calls GLGE.Document.onLoad() prior to COLLADA models being
// loaded. It'd be nice to have a Grand Unified Asset Management System that
// handled JavaScript, GLGE scne XML, COLLADA models and their images, and
// audio.

var NUM_ASSETS = 6;

var assetFinished = (function() {
  var display = $('#preloader');

  // Start count at one so the progress bar starts with some progress.
  var count = 1;

  // In case something stalls, start the game anyway.
  var timeout = setTimeout(function() {
    alert(1);
    display.remove();
    init();
  }, 10000);

  return function() {
    count++;
    if (count > NUM_ASSETS) { // Not >=, then init() would be called twice.
      clearTimeout(timeout);
      display.remove();
      init();
    } else {
      display.find('.inner').width(count / NUM_ASSETS * 100 + '%');
    }
    return true;
  };
})();

$(music.context).on('canplay', assetFinished);
$(soundfx.context).on('canplay', assetFinished);

var duck = new GLGE.Collada();
duck.setDocument('assets/duck.dae', null, assetFinished);

var target = new GLGE.Collada();
target.setDocument('assets/target.dae', null, assetFinished);

var ship = new GLGE.Collada();
ship.setDocument('assets/seymourplane_triangulate.dae', null, assetFinished);

var doc = new GLGE.Document();
doc.onLoad = assetFinished;
doc.load('assets/scene.xml');

// Duck Object Creation
// ====================
//
// A cheesy way to clone COLLADA objects until GLGE supports this.

function createDuckie(model, animation) {
  if (!duck.xml) throw new Error("Collada model not loaded");

  var source = duck.getObjects()[0]; // Ew.
  var dest = new GLGE.Object();
  dest.setScale(0.01);
  dest.setRotX(Math.PI / 2);
  dest.setRotY(Math.random() * 2 * Math.PI);
  dest.setMesh(source.getMesh());
  dest.setMaterial(source.getMaterial());
  dest.setLocX(model.attributes.x);
  dest.setLocY(model.attributes.y);

  // Start the bobbing at a random frame so each duck bobs independently.
  dest.setAnimation(animation);
  dest.animationStart = new Date().getTime() - Math.floor(Math.random() * 1000);

  return dest;
}

// Main
// ====

function init() {
  var menu = $('#menu').show();
  var scorecard = $('#scorecard').hide();
  scorecard.find('.info').html(menu.find('.info').html());

  var canvas = $('canvas');
  var debug = $('#debug');

  // Standard GLGE initialization.
  var renderer = new GLGE.Renderer(canvas[0]);
  scene = doc.getElement('mainscene');
  renderer.setScene(scene);
  window.camera = scene.getCamera(); // XXX

  var bob = doc.getElement('bob');
  var disappear = doc.getElement('disappear');

  // TODO: Update this.
  var viewport = {
    top: 14,
    bottom: -14,
    left: -27,
    right: 27
  };

  // Initialize the player's ship.
  ship.setLocZ(5);
  ship.setRotX(Math.PI / 2);
  ship.setRotY(Math.PI / 2);
  ship.setScale(0.3);
  ship.setFrameRate(60);
  scene.addChild(ship);

  // Initialize the aiming target.
  target.setLocZ(0.4);
  target.setScale(0.001);
  target.setRotX(Math.PI / 2);
  target.setRotY(Math.PI / 2);
  scene.addChild(target);

  // Create the Backbone model and controller.
  var ducks = {};
  var game = new GameController();

  // Show or hide the target depending on the game mode.
  game.bind('start', function() {
    if (game.mode === game.PLAY_MODE) {
      target.setVisible(GLGE.TRUE);
    } else {
      target.setVisible(GLGE.FALSE);
    }
  });

  $(window).on('keyup', function() {game.ducks.reset();}); //XXX

  // Show the scorecard when the last duck has been cleared. Wait a little bit
  // after the duck is cleared, otherwise the experience is sudden and jarring.
  game.bind('gameover', function(seconds) {
    setTimeout(function() {
      var rank = game.getRank(seconds);
      scorecard.find('.time').text(seconds + ' sec.');
      scorecard.find('.rank').text(rank[0]);
      scorecard.find('.byline').text(rank[1]);
      scorecard.show();
      game.start(game.DEMO_MODE);
    }, 1000);
  });

  // Update the model during any mouse movements.
  canvas.on('mousemove', function(e) {
    if (game.mode !== game.PLAY_MODE) return;

    // This is stupid. I should really be casting a ray from the camera to the
    // ground, but I'm lazy, and this is close enough.
    var mx = e.offsetX, my = e.offsetY;
    var cw = canvas.width(), ch = canvas.height();
    var vx = (mx / cw) * (viewport.right + -viewport.left) + viewport.left;
    var vy = (my / ch) * (viewport.top + -viewport.bottom) + viewport.bottom;
    game.ship.set({ targetX: vx, targetY: -vy });
  });

  // When the ship or target move, update the GLGE objects. Currently the game
  // and OpenGL are using the same units so no translation needs to be done.
  var oldBank = 0;
  game.ship.bind('change', function(model) {

    // Update the ship model.
    var a = model.attributes;
    ship.setLocX(a.x);
    ship.setLocY(a.y);
    ship.setRotY(Trig.deg2rad(a.dir) + 1.57);

    // Update the mouse target.
    target.setLocX(a.targetX);
    target.setLocY(a.targetY);

    // If the ship direction has changed, make it bank to one side or the other.
    // BUG: Sometimes the plane banks the wrong way.
    var newBank = a.delta < 0 ? -1 : a.delta > 0 ? 1 : 0;
    if (newBank != oldBank) {
      ship.blendTo({ DRotZ: newBank }, 500);
      oldBank = newBank;
    }
  });

  // When a duck is added, create it and add it to the scene. Keep track of it
  // in the `ducks` map so we can remove it later.
  game.ducks.bind('add', function(model) {
    var obj = createDuckie(model, bob);
    scene.addChild(obj);
    ducks[model.cid] = obj; // Backbone generates the cid property automatically.
  });

  // Remove a duck once it's removed from the collection invidiually.
  game.ducks.bind('remove', function(model) {
    var obj = ducks[model.cid];
    obj.setAnimation(disappear);
    obj.setLoop(GLGE.FALSE);
    obj.addEventListener('animFinished', function() {
      scene.removeChild(obj);
    });
    delete ducks[model.cid];

    if (game.mode === game.PLAY_MODE) {
      soundfx.play('pickup', true);
    }
  });

  // If there's a bulk update to the ducks, don't do any animation.
  game.ducks.bind('reset', function(models) {
    _.each(_.values(ducks), function(obj) {
      scene.removeChild(obj);
      delete ducks[obj.cid];
    });
  });

  // Handle canvas resizing (buggy)
  function resize() {
    var w = $(window).width(), h = $(window).height();
    canvas.attr({ width: w, height: h });
    scene.getCamera().setAspect(w / h);
    renderer.clearViewport();
  }
  $(document).on('ready', resize);
  $(window).on('resize', resize);
  resize();

  // Animation loop
  (function animloop(){
    requestAnimFrame(animloop);
    renderer.render();
  })();

  // Handle the big "Play!" button on the menu and scorecard.
  function startNewGame() {
    game.start(game.PLAY_MODE);
    menu.hide();
    scorecard.hide();
  }
  menu.on('click button', startNewGame);
  scorecard.on('click button', startNewGame);

  // Start the demo and play some music.
  game.start(game.DEMO_MODE);
  music.play('track1');

}
