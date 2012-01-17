/*
 * Jukebox
 * http://github.com/zynga/jukebox
 *
 * Copyright 2011, Zynga Inc.
 * Licensed under the MIT License.
 * https://raw.github.com/zynga/jukebox/master/MIT-LICENSE.txt
 *
 */


/*
 * This will construct a Jukebox instance.
 * The Jukebox Manager itself is transparent and irrelevant for usage.
 * @param {Object} settings The settings object (look defaults for more details)
 * @param {Number} [id] The optional id of the Jukebox (automatically managed if not given)
 */
var Jukebox = function(settings, origin) {

	this.id = ++Jukebox.__jukeboxId;
	this.origin = origin || null;

	this.settings = {};

	for (var d in this.defaults) {
		this.settings[d] = this.defaults[d];
	}

	for (var s in settings) {
		this.settings[s] = settings[s];
	}


	// The Jukebox Manager itself is transparent
	if (
		Jukebox.__manager === undefined
		&& typeof Jukebox.Manager === 'function'
	) {
		Jukebox.__manager = new Jukebox.Manager(this.settings.enforceFlash);
	}

	this.isPlaying = null;
	this.resource = null;

	// Use Jukebox Manager for Codec and Feature Detection
	if (Jukebox.__manager) {
		this.resource = Jukebox.__manager.getPlayableResource(this.settings.resources);

	// No Jukebox Manager? So it's a forced Playback
	} else if (this.settings.resources.length === 1) {
		this.resource = this.settings.resources[0];
	}

	// Still no resource? Stupidz!
	if (this.resource === null) {
		// GrandMa should update her Browser -.-
		throw "Either your Browser can't play the given resources - or you have missed to include Jukebox Manager.";
	} else {
		this.__init();
	}

	return this;

};



/*
 * The unique Jukebox ID
 */
Jukebox.__jukeboxId = 0;

Jukebox.prototype = {

	defaults: {
		resources: [], // contains the audio file urls
		autoplay: false, // deactivated by default
		spritemap: {}, // spritemap entries
		loop: false, // loops the complete stream again
		flashMediaElement: './swf/FlashMediaElement.swf',
		enforceFlash: false, // will disable all HTML5 stuff
		canplaythroughTimeout: 1000, // timeout if EventListener fails
	},

	/*
	 * PRIVATE API
	 */
	__addToManager: function(event) {

		if (this.__wasAddedToManager !== true) {
			Jukebox.__manager.addJukebox(this);
			this.__wasAddedToManager = true;
		}

	},

	/*
	__log: function(title, desc) {

		if (!this.__logElement) {
			this.__logElement = document.createElement('ul');
			document.body.appendChild(this.__logElement);
		}

		var that = this;
		window.setTimeout(function() {
			var item = document.createElement('li');
			item.innerHTML = '<b>' + title + '</b>: ' + (desc ? desc : '');
			that.__logElement.appendChild(item);
		}, 0);

	},

	__updateBuffered: function(event) {

		var buffer = this.context.buffered;

		if (buffer) {

			for (var b = 0; b < buffer.length; b++) {
				this.__log(event.type, buffer.start(b).toString() + ' / ' + buffer.end(b).toString());
			}

		}

	},
	*/

	// TODO: Optimize the use case for origin
	__init: function() {

		var that = this,
			settings = this.settings,
			features = Jukebox.__manager.features || {},
			api;


		// HTML5 Audio
		if (features.html5audio) {

			this.context = new Audio();
			this.context.src = this.resource;

			if (this.origin === null) {

				// This will add the stream to the manager's stream cache,
				// there's a fallback timeout if the canplaythrough event wasn't fired
				var addFunc = function(event){ that.__addToManager(event); };
				this.context.addEventListener('canplaythrough', addFunc, true);

				// Uh, Oh, What is it good for? Uh, Oh ...
				/*
					var bufferFunc = function(event) { that.__updateBuffered(event); };
					this.context.addEventListener('loadedmetadata', bufferFunc, true);
					this.context.addEventListener('progress', bufferFunc, true);
				*/

				// This is the timeout, we will penetrate the currentTime anyways.
				window.setTimeout(function(){
					that.context.removeEventListener('canplaythrough', addFunc, true);
					addFunc('timeout');
				}, settings.canplaythroughTimeout);

			}

			// old WebKit
			this.context.autobuffer = true;

			// new WebKit
			this.context.preload = true;


			// FIXME: This is the hacky API, but got no more generic idea for now =/
			for (api in this.HTML5API) {
				this[api] = this.HTML5API[api];
			}

			if (features.channels > 1) {

				if (settings.autoplay === true) {
					this.context.autoplay = true;
				} else if (settings.spritemap[settings.autoplay]) {
					this.play(settings.autoplay);
				}

			} else if (features.channels === 1 && settings.spritemap[settings.autoplay]) {

				this.__backgroundMusic = settings.spritemap[settings.autoplay];

				// Initial playback will do the trick for iOS' security model
				this.play(settings.autoplay);

			}


		// Flash Audio
		} else if (features.flashaudio) {

			// FIXME: This is the hacky API, but got no more generic idea for now =/
			for (api in this.FLASHAPI) {
				this[api] = this.FLASHAPI[api];
			}

			var flashVars = [
				'id=jukebox-flashstream-' + this.id,
				'autoplay=' + settings.autoplay,
				'file=' + window.encodeURIComponent(this.resource)
			];

			// Too much crappy code, have this in a crappy function instead.
			this.__initFlashContext(flashVars);

			if (settings.autoplay === true) {
				this.play(0);
			} else if (settings.spritemap[settings.autoplay]) {
				this.play(settings.autoplay);
			}

		} else {

			throw "Your Browser does not support Flash Audio or HTML5 Audio.";

		}

	},

	/*
	 * This is not that simple, better code structure with a helper function
	 */
	__initFlashContext: function(flashVars) {

		var context,
			url = this.settings.flashMediaElement,
			p;

		var params = {
			'flashvars': flashVars.join('&'),
			'quality': 'high',
			'bgcolor': '#000000',
			'wmode': 'transparent',
			'allowscriptaccess': 'always',
			'allowfullscreen': 'true'
		};

		/*
		 * IE will only render a Shockwave Flash file if there's this crappy outerHTML used.
		 */
		if (navigator.userAgent.match(/MSIE/)) {

			context = document.createElement('div');

			// outerHTML only works in IE when context is already in DOM
			document.getElementsByTagName('body')[0].appendChild(context);


			var object = document.createElement('object');

			object.id = 'jukebox-flashstream-' + this.id;
			object.setAttribute('type', 'application/x-shockwave-flash');
			object.setAttribute('classid', 'clsid:d27cdb6e-ae6d-11cf-96b8-444553540000');
			object.setAttribute('width', '0');
			object.setAttribute('height', '0');


			// IE specific params
			params.movie = url + '?x=' + (Date.now ? Date.now() : +new Date());
			params.flashvars = flashVars.join('&amp;');



			for (p in params) {

				var element = document.createElement('param');
				element.setAttribute('name', p);
				element.setAttribute('value', params[p]);
				object.appendChild(element);

			}

			context.outerHTML = object.outerHTML;

			this.context = document.getElementById('jukebox-flashstream-' + this.id);


		/*
		 * This is the case for a cool, but outdated Browser
		 * ... like Netscape or so ;)
		 */
		} else {

			context = document.createElement('embed');
			context.id = 'jukebox-flashstream-' + this.id;
			context.setAttribute('type', 'application/x-shockwave-flash');
			context.setAttribute('width', '100');
			context.setAttribute('height', '100');

			params.play = false;
			params.loop = false;
			params.src = url + '?x=' + (Date.now ? Date.now() : +new Date());

			for (p in params) {
				context.setAttribute(p, params[p]);
			}

			document.getElementsByTagName('body')[0].appendChild(context);

			this.context = context;

		}

	},

	/*
	 * This is the background hack for iOS and other single-channel systems
	 * It allows playback of a background music, which will be overwritten by playbacks
	 * of other sprite entries. After these entries, background music continues.
	 *
	 * This allows us to trick out the iOS Security Model after initial playback =)
	 */
	__backgroundHackForiOS: function() {

		if (this.__backgroundMusic === undefined) {
			return;
		}

		if (this.__backgroundMusic.started === undefined) {
			this.__backgroundMusic.started = Date.now ? Date.now() : +new Date();
			this.setCurrentTime(this.__backgroundMusic.start);
		} else {
			var now = Date.now ? Date.now() : +new Date();
			this.__backgroundMusic.__lastPointer = (( now - this.__backgroundMusic.started) / 1000) % (this.__backgroundMusic.end - this.__backgroundMusic.start) + this.__backgroundMusic.start;
			this.play(this.__backgroundMusic.__lastPointer);
		}

	},



	/*
	 * PUBLIC API
	 */

	/*
	 * This will play a given position on the stream.
	 * Optional argument is the enforce flag that will avoid queueing and will
	 * directly start the stream playback at the position.
	 *
	 * @param {Number} pointer The pointer (Float) in Seconds.
	 * @param {Boolean} [enforce] The enforce flag for direct playback
	 */
	play: function(pointer, enforce) {

		if (this.isPlaying !== null && enforce !== true) {

			if (Jukebox.__manager) {
				Jukebox.__manager.addQueueEntry(pointer, this.id);
			}

			return;

		}

		var spritemap = this.settings.spritemap,
			newPosition;

		// Spritemap Entry Playback
		if (spritemap[pointer] !== undefined) {

			newPosition = spritemap[pointer].start;

		// Seconds-Position Playback (find out matching spritemap entry)
		} else if (typeof pointer === 'number') {

			newPosition = pointer;

			for (var s in spritemap) {

				if (newPosition >= spritemap[s].start && newPosition <= spritemap[s].end) {
					pointer = s;
					break;
				}

			}

		}

		if (newPosition !== undefined && Object.prototype.toString.call(spritemap[pointer]) === '[object Object]') {

			this.isPlaying = this.settings.spritemap[pointer];

			// Start Playback, Stream will be corrected within the soundloop of the Jukebox.Manager
			if (this.context.play) {
				this.context.play();
			}

			// Locking due to slow Implementation on Mobile Devices
			this.wasReady = this.setCurrentTime(newPosition);

		}

	},

	/*
	 * This will stop the current playback and reset the pointer.
	 * Automatically starts the backgroundMusic again for Single-Channel (iOS) mode.
	 */
	stop: function() {

		this.__lastPosition = 0; // reset pointer
		this.isPlaying = null;

		// Was a Background Music played already?
		if (this.__backgroundMusic) {
			this.__backgroundHackForiOS();
		} else {
			this.context.pause();
		}

	},

	/*
	 * This will pause the current playback and cache the pointer position.
	 */
	pause: function() {

		this.isPlaying = null;

		this.__lastPosition = this.getCurrentTime();
		this.context.pause();

	},

	/*
	 * This will resume playback.
	 */
	resume: function() {

		if (this.__lastPosition !== null) {
			this.play(this.__lastPosition);
			this.__lastPosition = null;
		} else {
			this.context.play();
		}

	},



	/*
	 * HTML5 Audio API abstraction layer
	 */
	HTML5API: {

		/*
		 * This will return the current volume
		 * @returns {Number} volume (from 0 to 1.0)
		 */
		getVolume: function() {
			return this.context.volume || 1;
		},

		/*
		 * This will set the volume to a given value
		 * @param {Number} value The float value (from 0 to 1.0)
		 */
		setVolume: function(value) {
			this.context.volume = value;
		},

		/*
		 * This will return the current pointer position
		 * @returns {Number} pointer position (currentTime)
		 */
		getCurrentTime: function() {
			return this.context.currentTime || 0;
		},

		/*
		 * This will set the pointer position to a given value
		 * @param {Number} pointer position (Float)
		 * @returns {Boolean} Returns true if it was successfully set.
		 */
		setCurrentTime: function(value) {

			try {
				// DOM Exceptions are fired when Audio Element isn't ready yet.
				this.context.currentTime = value;
				return true;
			} catch(e) {
				return false;
			}

		}

	},



	/*
	 * Flash Audio API abstraction layer
	 */
	FLASHAPI: {

		/*
		 * This will return the current volume
		 * @returns {Number} volume (from 0 to 1.0)
		 */
		getVolume: function() {

			// Avoid stupid exceptions, wait for JavaScript API to be ready
			if (this.context && typeof this.context.getVolume === 'function') {
				return this.context.getVolume();
			}

			return 1;

		},

		/*
		 * This will set the volume to a given value
		 * @param {Number} value The float value (from 0 to 1.0)
		 */
		setVolume: function(value) {

			// Avoid stupid exceptions, wait for JavaScript API to be ready
			if (this.context && typeof this.context.setVolume === 'function') {
				this.context.setVolume(value);
			}

		},

		/*
		 * This will return the current pointer position
		 * @returns {Number} pointer position (currentTime)
		 */
		getCurrentTime: function() {

			// Avoid stupid exceptions, wait for JavaScript API to be ready
			if (this.context && typeof this.context.getCurrentTime === 'function') {
				return this.context.getCurrentTime();
			}

			return 0;

		},

		/*
		 * This will set the pointer position to a given value
		 * @param {Number} pointer position (Float)
		 * @returns {Boolean} Returns true if it was successfully set.
		 */
		setCurrentTime: function(value) {

			// Avoid stupid exceptions, wait for JavaScript API to be ready
			if (this.context && typeof this.context.setCurrentTime === 'function') {
				return this.context.setCurrentTime(value);
			}

			return false;

		}


	}

};

