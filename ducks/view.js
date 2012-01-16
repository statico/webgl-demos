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

// Asset system
// ============
//
// Because GLGE calls GLGE.Document.onLoad() prior to COLLADA models being
// loaded.

var NUM_ASSETS = 4;

var assetFinished = (function() {
  var count = 0;
  return function() {
    if (++count == NUM_ASSETS) init();
  };
})();

var duck = new GLGE.Collada();
duck.setDocument('assets/duck.dae', null, assetFinished);

var target = new GLGE.Collada();
target.setDocument('assets/target.dae', null, assetFinished);

var ship = new GLGE.Collada();
ship.setDocument('assets/seymourplane_triangulate.dae', null, assetFinished);

var doc = new GLGE.Document();
doc.onLoad = assetFinished;
doc.load('scene.xml');

// Duck Object Creation
// ====================
//
// A cheesy way to clone COLLADA objects until GLGE supports this.

function createDuckie() {
  if (!duck.xml) throw new Error("Collada model not loaded");
  var source = duck.getObjects()[0]; // Ew.
  var dest = new GLGE.Object();
  dest.setScale(0.01);
  dest.setRotX(Math.PI / 2);
  dest.setRotY(Math.random() * 2 * Math.PI);
  dest.setMesh(source.getMesh());
  dest.setMaterial(source.getMaterial());
  return dest;
}

// Main
// ====

function init() {
  var canvas = $('canvas');
  var renderer = new GLGE.Renderer(canvas[0]);
  scene = doc.getElement('mainscene');
  renderer.setScene(scene);

  var bob = doc.getElement('bob');

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

  // Update the model during any mouse movements.
  canvas.on('mousemove', function(e) {
    var mx = e.offsetX, my = e.offsetY;
    var cw = canvas.width(), ch = canvas.height();
    var vx = (mx / cw) * (viewport.right + -viewport.left) + viewport.left;
    var vy = (my / ch) * (viewport.top + -viewport.bottom) + viewport.bottom;
    game.ship.set({ targetX: vx, targetY: -vy });
  });

  // When the ship or target move, update the GLGE objects. Currently the game
  // and OpenGL are using the same units so no translation needs to be done.
  game.ship.bind('change', function(model) {
    var a = model.attributes;
    ship.setLocX(a.x);
    ship.setLocY(a.y);
    target.setLocX(a.targetX);
    target.setLocY(a.targetY);
  });

  // When a duck is added, create it and add it to the scene. Keep track of it
  // in the `ducks` map so we can remove it later.
  game.ducks.bind('add', function(model) {
    var obj = createDuckie();
    obj.setLocX(model.attributes.x);
    obj.setLocY(model.attributes.y);
    obj.setAnimation(bob);
    obj.animationStart = new Date().getTime() - Math.floor(Math.random() * 1000);
    scene.addChild(obj);
    ducks[model.cid] = obj; // Backbone generates the cid property automatically.
  });

  // Remove a duck once it's removed from the collection.
  game.ducks.bind('remove', function(model) {
    var obj = ducks[model.cid];
    scene.removeChild(obj);
  });

  // Handle canvas resizing (buggy)
  function resize() {
    var w = $(window).width(), h = $(window).height();
    canvas.attr({ width: w, height: h });
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

  // Start the game.
  game.start();

}
