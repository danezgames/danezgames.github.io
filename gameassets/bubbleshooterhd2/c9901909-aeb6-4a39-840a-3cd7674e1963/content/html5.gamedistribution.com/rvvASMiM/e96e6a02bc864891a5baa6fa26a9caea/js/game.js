(function(){
var G={};
window.G = G;
window.gameG = G;
if (typeof G == 'undefined') G = {};

G.ExtLoader = function(){

    Phaser.Loader.call(this,game);
    game.state.onStateChange.add(this.reset,this);
    this.imagesToRemoveOnStateChange = [];
    this.loadedUrls = {}; 

};

G.ExtLoader.prototype = Object.create(Phaser.Loader.prototype);

G.ExtLoader.prototype.reset = function(hard, clearEvents){

    this.imagesToRemoveOnStateChange.forEach(function(key) {
      this.cache.removeImage(key);
  },this);
  this.imagesToRemoveOnStateChange = [];

    Phaser.Loader.prototype.reset.call(this,hard,clearEvents);

};

G.ExtLoader.prototype.addToFileList = function(type, key, url, properties, overwrite, extension) {

    if (overwrite === undefined) {
        overwrite = false;
    }

    if (key === undefined || key === '') {
        console.warn("Phaser.Loader: Invalid or no key given of type " + type);
        return this;
    }

    if (url === undefined || url === null) {
        if (extension) {
            url = key + extension;
        } else {
            console.warn("Phaser.Loader: No URL given for file type: " + type + " key: " + key);
            return this;
        }
    }

    var file = {
        type: type,
        key: key,
        path: this.path,
        url: url,
        syncPoint: this._withSyncPointDepth > 0,
        data: null,
        loading: false,
        loaded: false,
        error: false
    };

    if (properties) {
        for (var prop in properties) {
            file[prop] = properties[prop];
        }
    }

    var fileIndex = this.getAssetIndex(type, key);

    if (overwrite && fileIndex > -1) {
        var currentFile = this._fileList[fileIndex];

        if (!currentFile.loading && !currentFile.loaded) {
            this._fileList[fileIndex] = file;
        } else {
            this._fileList.push(file);
            this._totalFileCount++;
        }
    } else if (fileIndex === -1) {
        this._fileList.push(file);
        this._totalFileCount++;
    }

    this.loadFile(this._fileList.shift());

    return this;

}

G.ExtLoader.prototype.asyncComplete = function(file, errorMessage) {

    if (errorMessage === undefined) {
        errorMessage = '';
    }

    file.loaded = true;
    file.error = !! errorMessage;

    if (errorMessage) {
        file.errorMessage = errorMessage;

        console.warn('Phaser.Loader - ' + file.type + '[' + file.key + ']' + ': ' + errorMessage);
        // debugger;
    }

    //this.processLoadQueue();

}

G.ExtLoader.prototype.fileComplete =  function(file, xhr) {

  var loadNext = true;



  switch (file.type) {
      case 'packfile':

          // Pack data must never be false-ish after it is fetched without error
          var data = JSON.parse(xhr.responseText);
          file.data = data || {};
          break;

      case 'image':

          this.cache.addImage(file.key, file.url, file.data);
          break;

      case 'spritesheet':

          this.cache.addSpriteSheet(file.key, file.url, file.data, file.frameWidth, file.frameHeight, file.frameMax, file.margin, file.spacing);
          break;

      case 'textureatlas':

          if (file.atlasURL == null) {
              this.cache.addTextureAtlas(file.key, file.url, file.data, file.atlasData, file.format);
          } else {
              //  Load the JSON or XML before carrying on with the next file
              loadNext = false;

              if (file.format == Phaser.Loader.TEXTURE_ATLAS_JSON_ARRAY || file.format == Phaser.Loader.TEXTURE_ATLAS_JSON_HASH || file.format == Phaser.Loader.TEXTURE_ATLAS_JSON_PYXEL) {
                  this.xhrLoad(file, this.transformUrl(file.atlasURL, file), 'text', this.jsonLoadComplete);
              } else if (file.format == Phaser.Loader.TEXTURE_ATLAS_XML_STARLING) {
                  this.xhrLoad(file, this.transformUrl(file.atlasURL, file), 'text', this.xmlLoadComplete);
              } else {
                  throw new Error("Phaser.Loader. Invalid Texture Atlas format: " + file.format);
              }
          }
          break;

      case 'bitmapfont':

          if (!file.atlasURL) {
              this.cache.addBitmapFont(file.key, file.url, file.data, file.atlasData, file.atlasType, file.xSpacing, file.ySpacing);
          } else {
              //  Load the XML before carrying on with the next file
              loadNext = false;
              this.xhrLoad(file, this.transformUrl(file.atlasURL, file), 'text', function(file, xhr) {
                  var json;

                  try {
                      // Try to parse as JSON, if it fails, then it's hopefully XML
                      json = JSON.parse(xhr.responseText);
                  } catch (e) {}

                  if ( !! json) {
                      file.atlasType = 'json';
                      this.jsonLoadComplete(file, xhr);
                  } else {
                      file.atlasType = 'xml';
                      this.xmlLoadComplete(file, xhr);
                  }
              });
          }
          break;

      case 'video':

          if (file.asBlob) {
              try {
                  file.data = xhr.response;
              } catch (e) {
                  throw new Error("Phaser.Loader. Unable to parse video file as Blob: " + file.key);
              }
          }

          this.cache.addVideo(file.key, file.url, file.data, file.asBlob);
          break;

      case 'audio':

          if (this.game.sound.usingWebAudio) {
              file.data = xhr.response;

              this.cache.addSound(file.key, file.url, file.data, true, false);

              if (file.autoDecode) {
                  this.game.sound.decode(file.key);
              }
          } else {
              this.cache.addSound(file.key, file.url, file.data, false, true);
          }
          break;

      case 'text':
          file.data = xhr.responseText;
          this.cache.addText(file.key, file.url, file.data);
          break;

      case 'shader':
          file.data = xhr.responseText;
          this.cache.addShader(file.key, file.url, file.data);
          break;

      case 'physics':
          var data = JSON.parse(xhr.responseText);
          this.cache.addPhysicsData(file.key, file.url, data, file.format);
          break;

      case 'script':
          file.data = document.createElement('script');
          file.data.language = 'javascript';
          file.data.type = 'text/javascript';
          file.data.defer = false;
          file.data.text = xhr.responseText;
          document.head.appendChild(file.data);
          if (file.callback) {
              file.data = file.callback.call(file.callbackContext, file.key, xhr.responseText);
          }
          break;

      case 'binary':
          if (file.callback) {
              file.data = file.callback.call(file.callbackContext, file.key, xhr.response);
          } else {
              file.data = xhr.response;
          }

          this.cache.addBinary(file.key, file.data);

          break;
  }

  this.onFileComplete.dispatch(0, file.key, !file.error); 

}
/*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js */
var saveAs=saveAs||function(e){"use strict";if(typeof e==="undefined"||typeof navigator!=="undefined"&&/MSIE [1-9]\./.test(navigator.userAgent)){return}var t=e.document,n=function(){return e.URL||e.webkitURL||e},r=t.createElementNS("http://www.w3.org/1999/xhtml","a"),o="download"in r,a=function(e){var t=new MouseEvent("click");e.dispatchEvent(t)},i=/constructor/i.test(e.HTMLElement)||e.safari,f=/CriOS\/[\d]+/.test(navigator.userAgent),u=function(t){(e.setImmediate||e.setTimeout)(function(){throw t},0)},s="application/octet-stream",d=1e3*40,c=function(e){var t=function(){if(typeof e==="string"){n().revokeObjectURL(e)}else{e.remove()}};setTimeout(t,d)},l=function(e,t,n){t=[].concat(t);var r=t.length;while(r--){var o=e["on"+t[r]];if(typeof o==="function"){try{o.call(e,n||e)}catch(a){u(a)}}}},p=function(e){if(/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(e.type)){return new Blob([String.fromCharCode(65279),e],{type:e.type})}return e},v=function(t,u,d){if(!d){t=p(t)}var v=this,w=t.type,m=w===s,y,h=function(){l(v,"writestart progress write writeend".split(" "))},S=function(){if((f||m&&i)&&e.FileReader){var r=new FileReader;r.onloadend=function(){var t=f?r.result:r.result.replace(/^data:[^;]*;/,"data:attachment/file;");var n=e.open(t,"_blank");if(!n)e.location.href=t;t=undefined;v.readyState=v.DONE;h()};r.readAsDataURL(t);v.readyState=v.INIT;return}if(!y){y=n().createObjectURL(t)}if(m){e.location.href=y}else{var o=e.open(y,"_blank");if(!o){e.location.href=y}}v.readyState=v.DONE;h();c(y)};v.readyState=v.INIT;if(o){y=n().createObjectURL(t);setTimeout(function(){r.href=y;r.download=u;a(r);h();c(y);v.readyState=v.DONE});return}S()},w=v.prototype,m=function(e,t,n){return new v(e,t||e.name||"download",n)};if(typeof navigator!=="undefined"&&navigator.msSaveOrOpenBlob){return function(e,t,n){t=t||e.name||"download";if(!n){e=p(e)}return navigator.msSaveOrOpenBlob(e,t)}}w.abort=function(){};w.readyState=w.INIT=0;w.WRITING=1;w.DONE=2;w.error=w.onwritestart=w.onprogress=w.onwrite=w.onabort=w.onerror=w.onwriteend=null;return m}(typeof self!=="undefined"&&self||typeof window!=="undefined"&&window||this.content);if(typeof module!=="undefined"&&module.exports){module.exports.saveAs=saveAs}else if(typeof define!=="undefined"&&define!==null&&define.amd!==null){define("FileSaver.js",function(){return saveAs})}
if (typeof G == 'undefined') G = {};


G.Button = function (x, y, sprite, callback, context) {
	Phaser.Button.call(this, game, G.l(x), G.l(y), null);

	this.state = game.state.getCurrentState();

	G.changeTexture(this, sprite);
	this.anchor.setTo(0.5);

	this.sfx = G.sfx.pop;

	this.active = true;

	this.onClick = new Phaser.Signal();
	if (callback) {
		this.onClick.add(callback, context || this);
	}

	if (game.device.desktop) {
		this.onInputUp.add(this.click, this);
	} else {
		this.onInputUp.add(this.click_Mobile, this);
	}

	this.terms = [];

	this.IMMEDIATE = false;

	this.scaleOnClick = true;

	this.targetAlphaTermsNotFulfilled = 0.5;
	this.targetAlpha = 1;

	this.refractorPeriod = 400;
	this.scaleChange = 0.1;
	this.pulsing = false;
}

G.Button.prototype = Object.create(Phaser.Button.prototype);
G.Button.constructor = G.Button;

G.Button.prototype.update = function () {

	if (this.checkTerms()) {
		this.targetAlpha = 1;
	} else {
		this.targetAlpha = this.targetAlphaTermsNotFulfilled;
	}

	this.alpha = G.lerp(this.alpha, this.targetAlpha, 0.2, 0.05);
	this.updateChildren();
};

G.Button.prototype.pulse = function (maxScale) {
	this.pulsing = true;
	this.pulsingTween = game.add.tween(this.scale).to({ x: maxScale || 1.1, y: maxScale || 1.1 }, 500, Phaser.Easing.Sinusoidal.InOut, true, 0, -1, true);
};

G.Button.prototype.stopPulse = function (maxScale) {
	if (this.pulsingTween) this.pulsingTween.stop();
	this.scale.setTo(maxScale || 1);
	this.pulsing = false;
};


G.Button.prototype.click = function () {
	if (!this.active) return;

	if (!this.checkTerms()) return;

	this.active = false;
	this.onClick.dispatch();

	if (this.sfx) this.sfx.play();

	var orgScaleX = this.scale.x;
	var orgScaleY = this.scale.y;

	if (this.IMMEDIATE) {
		this.active = true;
	} else {
		if (this.pulsing || !this.scaleOnClick) {
			game.time.events.add(this.refractorPeriod, function () { this.active = true }, this);
		} else {
			game.add.tween(this.scale).to({ x: orgScaleX + this.scaleChange, y: orgScaleY + this.scaleChange }, Math.floor(this.refractorPeriod * 0.5), Phaser.Easing.Quadratic.Out, true).onComplete.add(function () {
				game.add.tween(this.scale).to({ x: orgScaleX, y: orgScaleY }, Math.floor(this.refractorPeriod * 0.5), Phaser.Easing.Quadratic.Out, true).onComplete.add(function () {
					this.active = true;
				}, this)
			}, this)
		}
	}
};

G.Button.prototype.click_Mobile = function () {

	const tempTimeOut = setTimeout(() => {
		if (!this.active) return;

		if (!this.checkTerms()) return;

		this.active = false;
		this.onClick.dispatch();

		if (this.sfx) this.sfx.play();

		var orgScaleX = this.scale.x;
		var orgScaleY = this.scale.y;

		if (this.IMMEDIATE) {
			this.active = true;
		} else {
			if (this.pulsing || !this.scaleOnClick) {
				game.time.events.add(this.refractorPeriod, function () { this.active = true }, this);
			} else {
				game.add.tween(this.scale).to({ x: orgScaleX + this.scaleChange, y: orgScaleY + this.scaleChange }, Math.floor(this.refractorPeriod * 0.5), Phaser.Easing.Quadratic.Out, true).onComplete.add(function () {
					game.add.tween(this.scale).to({ x: orgScaleX, y: orgScaleY }, Math.floor(this.refractorPeriod * 0.5), Phaser.Easing.Quadratic.Out, true).onComplete.add(function () {
						this.active = true;
					}, this)
				}, this)
			}
		}
		clearTimeout(tempTimeOut);
	}, 50);
};

G.Button.prototype.checkTerms = function () {

	for (var i = 0; i < this.terms.length; i++) {
		if (!this.terms[i][0].call(this.terms[i][1])) {
			return false;
		}
	}
	return true;
};

G.Button.prototype.addTerm = function (callback, context) {
	this.terms.push([callback, context]);
}

G.Button.prototype.addImageLabel = function (image) {
	this.label = game.make.image(0, 0, 'ssheet', image);
	this.label.anchor.setTo(0.5);
	this.addChild(this.label);
};

G.Button.prototype.addTextLabel = function (font, text, size) {
	var multi = 1 / G.Loader.currentConfigMulti;
	this.label = new G.OneLineText(-5, -12, font, text, size || Math.floor(this.height * multi * 0.7), this.width * multi * 0.9, 0.5, 0.5);
	this.addChild(this.label);
};

G.Button.prototype.addTextLabelonMenuButton = function (font, text, size) {
	var multi = 1 / G.Loader.currentConfigMulti;
	this.label = new G.OneLineText(-5, -12, font, text, size || Math.floor(this.height * multi * 0.7), this.width * multi * 0.9, 0.5, 0.5);
	this.label.scale.x = 0.9;
	this.addChild(this.label);
};

G.Button.prototype.addTextLabelGameOver = function (font, text, size) {
	var multi = 1 / G.Loader.currentConfigMulti;
	this.label = new G.OneLineText(0, -15, font, text, size || Math.floor(this.height * multi * 0.7), this.width * multi * 0.9, 0.5, 0.5);
	this.addChild(this.label);
};

G.Button.prototype.addTextLabelMultiline = function (font, text) {
	var multi = 1 / G.Loader.currentConfigMulti;
	this.label = new G.MultiLineText(0, 0, font, text, Math.floor(this.height * multi * 0.5), this.width * multi * 0.8, this.height * multi * 0.7, 'center', 0.5, 0.5);
	this.addChild(this.label);
};

G.Button.prototype.addGTextLabel = function (text, style) {
	this.label = new G.Text(0, 0, text, style, 0.5, this.width * 0.9, this.height * 0.9, true, 'center');
	this.addChild(this.label);
};

G.Button.prototype.stopTweens = function () {
	G.stopTweens(this);
};

G.Button.prototype.changeTexture = function (image) {
	G.changeTexture(this, image);
};

G.Button.prototype.add = function (obj) {
	return this.addChild(obj)
};

G.Button.prototype.updateChildren = function () {
	for (var i = this.children.length; i--;) {
		this.children[i].update();
	}
};

if (typeof G == 'undefined') G = {};


G.FrameAnimation = function(x,y,frameName,frameRate,autoPlay) {

	Phaser.Image.call(this,game,G.l(x),G.l(y));

	this.anchor.setTo(0.5);

	this.frameNamePrefix = frameName;
	this.animFramesLen = this.getAnimationLength(this.frameNamePrefix);

	this.timerEvery = frameRate ? (60/frameRate) : 1;
	this.animDir = 1;

	G.changeTexture(this,this.frameNamePrefix+'_0');

	this.currentTimer = 0;
	this.currentIndex = 0;

	this.onFinish = new Phaser.Signal();

	this.active = autoPlay || false;
	

};

G.FrameAnimation.prototype = Object.create(Phaser.Image.prototype);

G.FrameAnimation.prototype.play = function(loop,bounce,startFrame) {

	this.currentTimer = 0;
	this.currentIndex = startFrame || 0;
	this.active = true;
	this.loop = loop-1 || 0;
	this.animDir = 1;
	this.bounce = bounce || false;
	G.changeTexture(this,this.frameNamePrefix+'_'+this.currentIndex);

	return this;

};

G.FrameAnimation.prototype.update = function() {

	if (!this.active) return;

	this.currentTimer+=G.deltaTime

	if (this.currentTimer >= this.timerEvery) {

		this.currentTimer = this.currentTimer-this.timerEvery;
		this.currentIndex += this.animDir;

		if (this.bounce) {
			if (this.currentIndex == this.animFramesLen || this.currentIndex == 0) {

				if (this.loop == 0 && this.currentIndex == 0) {
					this.onFinish.dispatch();
					return this.active = false;
				}

				if (this.loop > 0 && this.currentIndex == 0) {
					this.loop--;
				}

				if (this.currentIndex == this.animFramesLen) this.currentIndex = this.animFramesLen-1;
				
				this.animDir *= -1;

			}
		}else {

			if (this.currentIndex == this.animFramesLen) {
				if (this.loop == 0) {
					this.onFinish.dispatch();
					return this.active = false;
				}
				if (this.loop > 0) this.loop--;

				this.currentIndex = 0;

			}

		}

		G.changeTexture(this,this.frameNamePrefix+'_'+this.currentIndex);

	}

};

G.FrameAnimation.prototype.getAnimationLength = function(frameNamePrefix) {

	if (G.FrameAnimation.CacheAnimLength[frameNamePrefix]) return G.FrameAnimation.CacheAnimLength[frameNamePrefix];

	var len = 0;

	for (var i = 0; i < 1000; i++) {
		if (G.isImageInCache(frameNamePrefix+'_'+i)) {
			len++;
		}else {
			break;
		}
	}

	G.FrameAnimation.CacheAnimLength[frameNamePrefix] = len;

	return len;

};

G.FrameAnimation.CacheAnimLength = {};
/*G.Gift = function(type) {

	if (type === undefined) type = this.createRandom();

	if (type.constructor == G.Gift) return type;

	if (Array.isArray(type)) arguments = type;
	
	this.type = arguments[0];
	this.amount = arguments[1];
	this.icon = G.json.settings.gifts.icons[this.type];

	this.dataArray = Array.prototype.slice.call(arguments);

	this.applied = false;

};

G.Gift.prototype.createRandom = function() {


	var possibleGifts = [];
	
	G.json.settings.gifts.normals.list.forEach(function(e) {
		console.log(e);
		if (e[0] == 'coin') {
			possibleGifts.push(e);
		}else if (e[0].indexOf('booster') !== -1 && G.saveState.isBoosterUnlocked(parseInt(e[0][8]))) {
			possibleGifts.push(e);
		}
	});


	console.log(possibleGifts);

	return game.rnd.pick(possibleGifts);

};


G.Gift.prototype.getLabelString = function() {

	if (this.type == 'coin') {
		return	this.amount+' @'+this.icon+'@';
	}else if (this.type.indexOf('booster') !== -1) {
		return this.amount+'x '+'@'+this.icon+'@';
	}

};

G.Gift.prototype.getData = function() {

	return this.dataArray;

};

G.Gift.prototype.applyGift = function() {

	if (this.applied) return;

	if (this.type == 'coin') {
		G.saveState.changeCoins(this.amount);
	}else if (this.type.indexOf('booster') != -1) {
		G.saveState.changeBoosterAmount(parseInt(this.type[8]),this.amount);
	}

	this.applied = true;

}*/


G.gift = {};

G.gift.getGift = function(giftsGroup) {

	var giftsGroup = giftsGroup || 'normals';

	var giftsObj = G.json.settings.gifts[giftsGroup];

	var boosterMaxNr = giftsObj.boosterMaxNr || G.json.settings.gifts.boosterMaxNr;
	var boosterChance = giftsObj.boosterChance || G.json.settings.gifts.boosterChance;

	console.log(boosterMaxNr + ' & ' + boosterChance);

	var possibleGifts = [];

	
	
	giftsObj.list.forEach(function(e) {
		if (e[0] == 'coin') {
			possibleGifts.push(e);
		}else {

			if (e[0].indexOf('booster') !== -1 
			&& G.saveState.isBoosterUnlocked(parseInt(e[0][8])) 
			&& G.saveState.getBoosterAmount(parseInt(e[0][8])) < boosterMaxNr) {
				possibleGifts.push(e);
			}

		}
	});

	Phaser.ArrayUtils.shuffle(possibleGifts);

	var booster = Math.random() < boosterChance;

	for (var i = 0; i < possibleGifts.length; i++) {
		var gift = possibleGifts[i];
		if (gift[0].indexOf('booster') !== -1) {
			if (booster) {
				return gift.slice();
			}
		}else {
			return gift.slice();
		}
	}

	// fallback

	return ['coin',50];

};

G.gift.getLabelString = function(giftData) {
	return giftData[1]+' @'+G.json.settings.gifts.icons[giftData[0]]+'@';
};

G.gift.applyGift = function(giftData) {

	if (giftData[0] == 'coin') {
		G.saveState.changeCoins(giftData[1]);
	}else {
		G.saveState.changeBoosterAmount(parseInt(giftData[0][8]),giftData[1]);
	}

};

G.gift.getIcon = function(giftData) {

	return G.json.settings.gifts.icons[giftData[0]];

};
if (typeof G == 'undefined') G = {};

G.GridArray = function(width,height,value,dbg) {

	if (typeof width == 'number') {

		this.createGrid.apply(this,arguments);
		
	} else if (typeof width == "string")  {

		this.data = JSON.parse(arguments[0]);
		this.width = this.data.length;
		this.height = this.data[0].length;

	} else if (Array.isArray(width)) {
		a = arguments[0];
		this.data = arguments[0];
		this.width = this.data.length; 
		this.height = this.data[0].length;

	}

};

G.GridArray.prototype = {

	createGrid: function(width,height,value) {

		this.data = []; 
		this.width = width;
		this.height = height;

		for (var collumn = 0; collumn < width; collumn++) {
			this.data[collumn] = [];
			for (var row = 0; row < height; row++) {
				this.data[collumn][row] = value;
			}
		}

	},

	set: function(x,y,val) {
		if (this.isInGrid(x,y)) {
			return this.data[x][y] = val;
		}else {
			if (this.dbg) console.log("setValue OUT OF RANGE");
			return false;
		}
	},

	get: function(x,y) {
		if (this.isInGrid(x,y)) {
			return this.data[x][y];
		}else {
			if (this.dbg) console.log("getValue OUT OF RANGE");
			return false;
		}
	},

	swapValues: function(x1,y1,x2,y2) {

		if (this.isInGrid(x1,y1) && this.isInGrid(x2,y2)) {
			var tmp = this.data[x1][y1];
			this.data[x1][y1] = this.data[x2][y2];
			this.data[x2][y2] = tmp;
		}else {
			if (this.dbg) console.log("swapValues OUT OF RANGE");
			return false;
		}
		
	},

	isInGrid: function(x,y) {
		return !(x < 0 || x >= this.width || y < 0 || y >= this.height);
	},


	find: function(func,context) {

		for (var coll = 0; coll < this.width; coll++) {
			for (var row = 0; row < this.height; row++) {
				var val = func.call(context,this.data[coll][row],coll,row,this.data);
				if (val) return this.data[coll][row];
			}
		}

		return false;

	},


	filter: function(func,context) {

		var result = [];

		for (var coll = 0; coll < this.width; coll++) {
			for (var row = 0; row < this.height; row++) {
				var val = func.call(context,this.data[coll][row],coll,row,this.data);
				if (val) result.push(this.data[coll][row]);
			}
		}

		return result;
	},


	loop: function(func,context) {

		for (var coll = 0; coll < this.width; coll++) {
			for (var row = 0; row < this.height; row++) {
				func.call(context,this.data[coll][row],coll,row,this.data);
			}
		}
	},

	clear: function(value) {
		this.loop(function(elem,x,y,array) {
			array[x][y] = value || false;
		});
	},

	findPattern: function(positions,mark) {

		var result = false;
		var len = positions.length;

		this.loop(function(elem,x,y,array) {
			if (elem == mark && !result) {

				for (var i = 0; i < len; i+=2) {
					//console.log('pos: '+(x+positions[i])+'x'+(y+positions[i+1])+' val: ' + this.get(x+positions[i],y+positions[i+1]));
					if (!this.get(x+positions[i],y+positions[i+1])) return;
					if (this.get(x+positions[i],y+positions[i+1]) !== mark) return;
				}

				//console.log("PASSED FIRST LOOP "+x+'x'+y);
				result = [];
				for (var j = 0; j < len; j+=2) {
					result.push(x+positions[j],y+positions[j+1]);
				}
				//console.log('got patt: ');
				//console.log(x+'x'+y);
				//console.log(result);


			}
		},this);

		return result;

	},

	count: function(){

		var result = 0;

		for (var coll = 0; coll < this.width; coll++) {
			for (var row = 0; row < this.height; row++) {
				if (this.data[coll][row]) {
					result++;
				}
			}
		}

		return result;

	},

	getAllElements: function(){

		var result = [];

		for (var coll = 0; coll < this.width; coll++) {
			for (var row = 0; row < this.height; row++) {
				if (this.data[coll][row]) {
					result.push(this.data[coll][row]);
				}
			}
		}

		return result;

	}


};
G.Image = function(x,y,frame,anchor,groupToAdd) {

  Phaser.Image.call(this,game,G.l(x),G.l(y),null);

  //overwrite angle component, so angle is not wrapped anymore
  Object.defineProperty(this, 'angle', {
    get: function() {
        return Phaser.Math.radToDeg(this.rotation);
    },
    set: function(value) {
        this.rotation = Phaser.Math.degToRad(value);
    }
  });
  
  this.angle = 0;

  this.state = game.state.getCurrentState();

  this.changeTexture(frame);

  if (anchor) {
    if (typeof anchor == 'number') { 
        this.anchor.setTo(anchor);
    }else {
        this.anchor.setTo(anchor[0],anchor[1]);
    }
  }

  if (groupToAdd) { 
    (groupToAdd.add || groupToAdd.addChild).call(groupToAdd,this);
  }else if (groupToAdd !== null) {
    game.world.add(this);
  }

  

  
  //game.add.existing(this)
};

G.Image.prototype = Object.create(Phaser.Image.prototype);

G.Image.prototype.stopTweens = function() {
  G.stopTweens(this);
};

G.Image.prototype.changeTexture = function(image) {
  G.changeTexture(this,image);
};

Phaser.Image.prototype.changeTexture = function(image){
  G.changeTexture(this,image);
};

G.Image.prototype.add = function(obj) {
  return this.addChild(obj)
};
G.LabelGroupT = function(str,x,y,textStyle,anchor,maxWidth,distanceBetween){

	Phaser.Group.call(this,game);

	this.str = str;
	this.tagArray = G.LabelParser.changeIntoTagArray(str);

	this.x = x;
	this.y = y;
	this.textStyle = textStyle;
	this.fontSize = parseInt(textStyle.fontSize);

	this.distanceBetween = distanceBetween || 0;

    if (typeof anchor == 'number') { 
        this.anchorX = this.anchorY = anchor;
    }else {
        this.anchorX = anchor[0];
        this.anchorY = anchor[1];
    }
	

	this.maxWidth = maxWidth || 0;

	this.processTagArray();

};

G.LabelGroupT.prototype = Object.create(Phaser.Group.prototype);

G.LabelGroupT.prototype.processTagArray = function(){

	for (var i = 0; i < this.tagArray.length; i++) {
		if (this.tagArray[i].type == 'img') {
			var img = G.makeImage(0,0,this.tagArray[i].content,0,this);
			img.tagScale = this.tagArray[i].scale;
		}else if(this.tagArray[i].type == 'separator') {
			var img = G.makeImage(0,0,null,0,this);
			img.SEPARATOR = true;
			img.SEP_LENGTH = this.tagArray[i].length;
		}else {
			this.add(new G.Text(0,0,this.tagArray[i].content,this.textStyle))
		}
	}

	this.refresh();

};

G.LabelGroupT.prototype.refresh = function(){

	this.applySizeAndAnchor();

	if (this.maxWidth > 0 && this.getWholeWidth() > this.maxWidth) {
		while(this.getWholeWidth() > this.maxWidth) {
			this.distanceBetween = Math.floor(this.distanceBetween*0.9);
			this.fontSize = Math.floor(this.fontSize*0.9);
			this.applySizeAndAnchor();
		}
	}
	
	this.spreadElements();

};


G.LabelGroupT.prototype.applySizeAndAnchor = function() {

	this.children.forEach(function(e) {
		e.anchor.setTo(this.anchorX,this.anchorY);
		if (e.fontSize) {
			e.fontSize = this.fontSize;
			e.updateTransform();
		}else {
			e.height = this.fontSize*(e.tagScale || 1);
			e.scale.x = e.scale.y;
		}

		if (e.SEPARATOR) {
			e.width = this.fontSize*e.SEP_LENGTH;
		}
		
	},this);

};

G.LabelGroupT.prototype.getWholeWidth = function() {

	var allDistanceBetween = (this.children.length-1) * this.distanceBetween;
	var widthOfAllElements = 0;
	this.children.forEach(function(e) {
		widthOfAllElements += e.width;
	});
	return allDistanceBetween + widthOfAllElements;

};

G.LabelGroupT.prototype.spreadElements = function() {

	var startX = this.getWholeWidth()*this.anchorX*-1;
	this.children.forEach(function(e,index,array) {
		e.left = (index== 0 ? startX : array[index-1].right+this.distanceBetween);
	},this);

};
//
// $ - text from json
// @ - img
// % - variable
// ^ - text as it is
//


G.LabelParser = {
	
	specialChars: ['$','@','%','^'],
	
	changeIntoTagArray: function(str,propObj) {

		var result = [];

		var i = 0;

		while (str.length > 0) {

			if (i++ > 20) break;

			var firstTag = this.findFirstSpecialChar(str);


			if (firstTag === -1) {
				result.push(str);
				break;
			}else {

				if (firstTag[0] > 0) {
					result.push(str.slice(0,firstTag[0]))
					str = str.slice(firstTag[0]);	
				}
				str = this.cutOffTag(str,result,firstTag[1]); 

			}

		} 

		// 
		// change strings into objects
		//

		var processedResult = [];
		for (var i = 0; i < result.length; i++) {
			processedResult.push(this.processTag(result[i],propObj));
		}

		// 
		// merge texts obj
		// 
		//

		return this.mergeTextTagsInArray(processedResult);;
	},


	mergeTextTagsInArray: function(tagArray) {

		var mergedArray = [];

		var startIndex = null;
		var endIndex = null;

		for (var i = 0; i < tagArray.length; i++) {

			if (tagArray[i].type !== 'text') {

				if (startIndex !== null) {
					mergedArray.push(this.mergeTextTags(tagArray,startIndex,i));
					startIndex = null;
				}

				mergedArray.push(tagArray[i]);				

			}else {
				if (startIndex == null) {
					startIndex = i;
				}
			}
		}


		if (startIndex !== null) {
			mergedArray.push(this.mergeTextTags(tagArray,startIndex,i))
		}

		return mergedArray;

	},

	mergeTextTags: function(array,startIndex,endIndex) {

		var newObj = {type:'text',content:[]};

		for ( ; startIndex < endIndex; startIndex++) {
			newObj.content.push(array[startIndex].content);
		}

		newObj.content = newObj.content.join(' ');

		return newObj;

	},

	processTag: function(elem,propObj) {

		if (elem[0] == '@') {

			var scale = 1;

			if (elem[1] == '*' && elem.indexOf('*',2)) {
				scale = parseFloat(elem.slice(elem.indexOf('*')+1,elem.indexOf('*',2)));
				elem = elem.slice(elem.indexOf('*',2));
			}

			return {
				type: 'img',
				content: elem.slice(1,-1),
				scale: scale
			}
		}else if (elem[0] == '%') {
			return {
				type: 'text',
				content: propObj[elem.slice(1,-1)]
			}
		}else if (elem[0] == '$') {
			
			return {
				type: 'text',
				content: G.txt(elem.slice(1,-1))
			}
		}else if (elem[0] == '^') {
			return {
				type: 'text',
				content: elem.slice(1,-1)
			}
		}else {

			if (this.isStringJustSpaces(elem)) {
				return {
					type: 'separator',
					content: elem,
					length: elem.length
				}
			}else {
				return {
					type: 'text',
					content: elem 
				}
			}

		}


	},

	isStringJustSpaces: function(elem) {
		for (var i = 0; i < elem.length; i++) {
			if (elem[i] !== ' ') return false;
		}
		return true;
	},

	cutOffTag: function(str,result,tag) {

		var startIndex = str.indexOf(tag);
		var endIndex = str.indexOf(tag,startIndex+1);

		result.push(str.slice(startIndex,endIndex+1));

		return str.slice(0,startIndex) + str.slice(endIndex+1);

	},

	findFirstSpecialChar: function(str) {

			var smallest = Infinity;
			var foundedChar = false;

			this.specialChars.forEach(function(char) {
				var index = str.indexOf(char)
			
				if (index > -1 && smallest > index) {
					foundedChar = char;
					smallest = Math.min(index,smallest);
				}
			});

			if (smallest === Infinity) return -1;

			return [smallest, foundedChar];

	},


	createLabel: function(string,propObj,x,y,font,fontSize,anchorX,anchorY,distanceBetween,maxWidth) {

		var tagArray = this.changeIntoTagArray(string,propObj);

		var group = new G.LabelGroup(x,y,fontSize,distanceBetween,anchorX,anchorY,maxWidth);

		

		return group;

	}

} 


G.LabelGroup = function(str,x,y,font,fontSize,anchorX,anchorY,maxWidth) {

	Phaser.Group.call(this,game);

	this.fontData = game.cache.getBitmapFont(font).font;
	this.fontBaseSize = this.fontData.size;
	this.fontSpaceOffset = this.fontData.chars['32'].xOffset + this.fontData.chars['32'].xAdvance;

	this.str = str;
	this.tagArray = G.LabelParser.changeIntoTagArray(str);


	this.x = (typeof x === 'undefined' ? 0 : G.l(x));
	this.y = (typeof y === 'undefined' ? 0 : G.l(y));
	this.font = font;
	this.fontSize = (typeof fontSize === 'undefined' ? G.l(30) : G.l(fontSize));
	//this.distanceBetween = (typeof distanceBetween === 'undefined' ? G.l(10) : G.l(distanceBetween));
	this.distanceBetween = 0;

	this.anchorX = (typeof anchorX === 'undefined' ? 0.5 : anchorX);
	this.anchorY = (typeof anchorY === 'undefined' ? 0.5 : anchorY);

	this.maxWidth = maxWidth || 0;

	this.processTagArray();

};

G.LabelGroup.prototype = Object.create(Phaser.Group.prototype);

G.LabelGroup.prototype.processTagArray = function() {

	for (var i = 0; i < this.tagArray.length; i++) {
		if (this.tagArray[i].type == 'img') {
			var img = G.makeImage(0,0,this.tagArray[i].content,0,this);
			img.tagScale = this.tagArray[i].scale;
		}else if(this.tagArray[i].type == 'separator') {
			var img = G.makeImage(0,0,null,0,this);
			img.SEPARATOR = true;
			img.SEP_LENGTH = this.tagArray[i].length;
		}else {
			this.add(game.add.bitmapText(0,0,this.font,this.tagArray[i].content,this.fontSize))
		}
	}


	this.refresh();

};

G.LabelGroup.prototype.refresh = function() {

	this.applySizeAndAnchor();

	if (this.maxWidth > 0 && this.getWholeWidth() > this.maxWidth) {
		while(this.getWholeWidth() > this.maxWidth) {
			this.distanceBetween *= 0.9;
			this.fontSize *= 0.9;
			this.applySizeAndAnchor();
		}
	}
	
	this.spreadElements();

};

G.LabelGroup.prototype.applySizeAndAnchor = function() {

	this.children.forEach(function(e) {
		e.anchor.setTo(this.anchorX,this.anchorY);

		if (e.fontSize) {
			e.fontSize = this.fontSize;
			e.updateText();
		}else {
			e.height = this.fontSize*(e.tagScale || 1);
			e.scale.x = e.scale.y;
		}

		

		if (e.SEPARATOR) {
			e.width = (this.fontSize/this.fontBaseSize*this.fontSpaceOffset)*e.SEP_LENGTH;
		}
		
	},this);

};

G.LabelGroup.prototype.getWholeWidth = function() {

	var allDistanceBetween = (this.children.length-1) * this.distanceBetween;
	var widthOfAllElements = 0;
	this.children.forEach(function(e) {
		widthOfAllElements += e.width;
	});

	return allDistanceBetween + widthOfAllElements;
};

G.LabelGroup.prototype.spreadElements = function() {

	var startX = this.getWholeWidth()*this.anchorX*-1

	this.children.forEach(function(e,index,array) {
		e.left = (index== 0 ? startX : array[index-1].right+this.distanceBetween);
	},this);

};
G.LineEditor = function(){

	Phaser.Group.call(this,game);

	this.gfx = game.add.graphics();
	this.gfx.fixedToCamera = true;

	this.points = {
		x: [],
		y: []
	};

	this.currentIndex = null;
	this.pointerStart = new Phaser.Point(0,0);

	this.interpolation = 'linearInterpolation';

	game.input.onDown.add(function(pointer){
		this.currentIndex = this.findCurrentIndex(pointer);
		if (this.currentIndex !== null){
			this.pointerStart.x = pointer.x;
			this.pointerStart.y = pointer.y;
		}
	},this);


	game.input.onUp.add(function(pointer){
		this.currentIndex = null;
	},this);

	this.keys = game.input.keyboard.addKeys({
		Z: Phaser.Keyboard.Z,
		X: Phaser.Keyboard.X,
		C: Phaser.Keyboard.C,
		A: Phaser.Keyboard.A,
		S: Phaser.Keyboard.S,
		D: Phaser.Keyboard.D
	});

	this.keys.Z.onDown.add(function(){
		this.interpolation = 'catmullRomInterpolation';
	},this);

	this.keys.X.onDown.add(function(){
		this.interpolation = 'bezierInterpolation';
	},this);

	this.keys.C.onDown.add(function(){
		this.interpolation = 'linearInterpolation';
	},this);

	this.keys.A.onDown.add(function(){
		var pointer = game.input.activePointer;
		this.points.x.push(pointer.x);
		this.points.y.push(pointer.y);
	},this);

	this.keys.S.onDown.add(function(){
		if (this.currentIndex){
			this.points.x.splice(this.currentIndex,1);
			this.points.y.splice(this.currentIndex,1);
		}
	},this);

	this.keys.D.onDown.add(function(){
		this.points.x.pop();
		this.points.y.pop();
	},this);

};

G.LineEditor.prototype = Object.create(Phaser.Group.prototype);

G.LineEditor.prototype.update = function(){

	if (this.currentIndex){
		var pointer = game.input.activePointer;
		var diffX = this.pointerStart.x - pointer.x;
		var diffY = this.pointerStart.y - pointer.y;
		this.pointerStart.x = pointer.x;
		this.pointerStart.y = pointer.y;
		this.points.x[this.currentIndex] -= diffX;
		this.points.y[this.currentIndex] -= diffY;
	}

	this.redraw();

};

G.LineEditor.prototype.findCurrentIndex = function(pointer){

	var index = null;
	var min = Infinity;

	for (var i = 0; i < this.points.x.length; i++){
		var dist = game.math.distance(pointer.x,pointer.y,this.points.x[i],this.points.y[i]);
		if (dist < min){
			index = i;
			min = dist;
		}
	}

	if (min < 10){
		return index;
	}else{
		return index;
	}

};


G.LineEditor.prototype.redraw = function(){

	this.gfx.clear();
	this.drawLine();
	this.drawPoints();

};

G.LineEditor.prototype.drawPoints = function(){

	this.gfx.lineStyle(2,0x0000ff,1);
	this.gfx.beginFill(0x0000ff,0.5);
	for (var i = 0; i < this.points.x.length; i++){
		this.gfx.drawCircle(
			this.points.x[i],
			this.points.y[i],
			10
		);
	}

};

G.LineEditor.prototype.drawLine = function(){

	if (this.points.x.length == 0) return;

	this.gfx.lineStyle(2,0xff0000,1);
	this.gfx.moveTo(this.points.x[0],this.points.y[0]);
	for (var i = 0; i < 1; i+=0.001){
		var x = game.math[this.interpolation](this.points.x,i);
		var y = game.math[this.interpolation](this.points.y,i);
		this.gfx.lineTo(x,y);
	}

};
if (typeof G == 'undefined') G = {};

G.Loader = {

	currentConfig : 'hd',
	currentConfigMulti : 1,
	loadingScreenActive: false, 
	lang: false,

	passConfigs: function(conf) {
		this.configs = conf;
	},

	setConfig: function(chosen) {
		this.currentConfig = chosen;
		this.currentConfigMulti = this.configs[chosen];
	},

	killLoadingScreen: function() {

		if (G.imgRotate) {
			G.whiteOverlay.destroy();
			G.imgRotate.fadeOut = true;
			G.imgRotate = false;
			this.loadingScreenActive = false;
		}

	},

	loadPOSTImage: function(name) {

		if (typeof name === 'undefined') return;

		if (!game.cache.checkImageKey(name)) {
			this.makeLoadingScreen();
			game.load.image(name,'assets/'+this.currentConfig+'/imagesPOST/'+name);
		}

	},

	loadBootAssets:function(lang){

		if (lang) this.lang = lang.toUpperCase();

		G.ASSETS.images.forEach(function(fileName) {
			if (!this.checkIfLoad(fileName,true)) return;
			console.log('loading ',fileName);
			game.load.image(
				this.removeExt(this.cutOffPrefixes(fileName)),
				'assets/'+this.currentConfig+'/images/'+fileName
			);
		},this); 

		G.ASSETS.spritesheets.forEach(function(elem) {
			if (!this.checkIfLoad(elem,true)) return;
			console.log('loading ',elem);
			game.load.atlasJSONHash(this.cutOffPrefixes(elem),'assets/'+this.currentConfig+'/spritesheets/'+elem+'.png','assets/'+this.currentConfig+'/spritesheets/'+elem+'.json');
		},this);

		game.load.onLoadComplete.addOnce(function(){
			this.createSpritesheetMap(true);
		},this);

	},

	loadAssets: function(lang) {

		if (lang) this.lang = lang.toUpperCase();

		game.load.onLoadComplete.addOnce(this.processAssets,this);
  	this.loadSFX(G.ASSETS.sfx);
  	this.loadImages(G.ASSETS.images);
  	this.loadSpritesheets(G.ASSETS.spritesheets);
  	this.loadJson(G.ASSETS.json);
  	this.loadFonts(G.ASSETS.fonts);

	},

	processAssets: function() {
		this.processJson(G.ASSETS.json);
		this.processSFX(G.ASSETS.sfx);

		this.createSpritesheetMap();

	},

	createSpritesheetMap: function(boot) {

		console.log('create spritesheets map');

		if (!G.spritesheetMap) G.spritesheetMap = {};

		for (var i = 0, len = G.ASSETS.spritesheets.length; i < len; i++) {
			
			if (!this.checkIfLoad(G.ASSETS.spritesheets[i],boot)) continue;
			var sheetName = this.cutOffPrefixes(G.ASSETS.spritesheets[i]);

      if (game.cache.checkImageKey(sheetName)) {

          var sheet = game.cache.getFrameData(sheetName);

          for (var frameIndex = 0; frameIndex < sheet._frames.length; frameIndex++) {

          	var frame = sheet._frames[frameIndex];

          	if (G.spritesheetMap[frame.name]) console.warn('Images name collision: '+frame.name);

          	G.spritesheetMap[frame.name] = sheetName;

          }
      }
  	} 

	},

	loadSFX: function(list) {
		list.forEach(function(fileName) {
			game.load.audio(
				this.removeExt(fileName),
				'assets/sfx/'+fileName
			);
		},this);
	},

	loadFonts: function(fontObj) {
		for (var font in fontObj) {
			if (!this.checkIfLoad(font)) return;
			game.load.bitmapFont(this.cutOffPrefixes(font),'assets/'+this.currentConfig+'/fonts/'+fontObj[font].frame,'assets/'+this.currentConfig+'/fonts/'+fontObj[font].data);
		}
	},

	loadImages: function(list) {
		list.forEach(function(fileName) {
			if (!this.checkIfLoad(fileName)) return;
			game.load.image(
				this.removeExt(this.cutOffPrefixes(fileName)),
				'assets/'+this.currentConfig+'/images/'+fileName
			);
		},this);
	},

	loadJson: function(list) {
		list.forEach(function(fileName) {
			game.load.json(this.removeExt(fileName), 'assets/json/'+fileName);
		},this);
	},

	loadSpritesheets: function(list) {

		list.forEach(function(elem) {
			if (!this.checkIfLoad(elem)) return;
			game.load.atlasJSONHash(this.cutOffPrefixes(elem),'assets/'+this.currentConfig+'/spritesheets/'+elem+'.png','assets/'+this.currentConfig+'/spritesheets/'+elem+'.json');
		},this);
	},

	checkIfLoad: function(fileName,bootPhase){

		if (bootPhase && fileName.indexOf('BOOT-') == -1) return false;
		if (!bootPhase && fileName.indexOf('BOOT-') !== -1) return false;
		if (fileName.indexOf('MOBILE-') !== -1 && game.device.desktop) return false;
		if (fileName.indexOf('DESKTOP-') !== -1 && !game.device.desktop) return false;

		if (this.lang && fileName.match(/^[A-Z]{2}\-/)){
			return fileName.indexOf(this.lang+'-') == 0;
		}else{
			return true;
		}

	},

	cutOffPrefixes: function(fileName){

		//cut off lang prefix
		fileName = fileName.replace(/^[A-Z]{2}\-/,'');

		fileName = fileName.replace('BOOT-','');
		fileName = fileName.replace('MOBILE-','');
		fileName = fileName.replace('DESKTOP-','');

		return fileName;

	},

	removeExt: function(fileName){
		return fileName.slice(0,fileName.lastIndexOf('.'));
	},

	processJson: function(list) {
		G.json = {};
		list.forEach(function(fileName) {
			fileName = this.removeExt(fileName);
			G.json[fileName] = game.cache.getJSON(fileName);
		},this); 
	},

	processSFX: function(list) {
		G.sfx = {};
		game.sfx = G.sfx;

		var clusters = {};

		list.forEach(function(elem) {

			elem = this.removeExt(elem);

			G.sfx[elem] = game.add.audio(elem);

			var lastIndex = elem.lastIndexOf('_');

			if (lastIndex !== -1 && !isNaN(elem.slice(lastIndex+1))){
				var number = parseInt(elem.slice(lastIndex+1)); 
				var name = elem.slice(0,lastIndex);
				if (!clusters[name]) clusters[name] = [];
				clusters[name].push(G.sfx[elem]);
			};
		},this);

		Object.keys(clusters).forEach(function(key){

			G.sfx[key] = {
				sfxArray: clusters[key],
				//play rnd
				play: function(volume, loop, forceRestart){
					game.rnd.pick(this.sfxArray).play('', 0, volume, loop, forceRestart);
				}
			}

		});
 
	},

};
G.MultiLineText = function(x,y,font,text,size,max_width,max_height,align,hAnchor,vAnchor) {  
  
  x = G.l(x);
  y = G.l(y);
  size = G.l(size);
  max_width = G.l(max_width);
  max_height = G.l(max_height);

  this.maxUserWidth = max_width;
  this.maxUserHeight = max_height;

  Phaser.BitmapText.call(this, game, x, y, font,'',size);
  
  //this.maxWidth = max_width;
  this.splitText(text,max_width);

  this.align = align || 'center';
  
  if (max_height) {
      while (this.height > max_height) {
        this.fontSize -= 2;
        this.splitText(text,max_width);
        this.updateText();
        if (this.fontSize < 5) break;
      }
  }

  this.anchor.setTo(hAnchor,vAnchor);

 // this.hAnchor = typeof hAnchor == 'number' ? hAnchor : 0.5;
  //this.vAnchor = typeof vAnchor == 'number' ? vAnchor : 0;

  this.cacheAsBitmap = true; 
  //this._cachedSprite.anchor.setTo(this.hAnchor,this.vAnchor);

};

G.MultiLineText.prototype = Object.create(Phaser.BitmapText.prototype);
G.MultiLineText.prototype.constructor = G.MultiLineText;


G.MultiLineText.prototype.splitText = function(text,max_width) {

  var txt = text;
  var txtArray = [];
  var prevIndexOfSpace = 0;
  var indexOfSpace = 0;
  var widthOverMax = false;

  while (txt.length > 0) {

    prevIndexOfSpace = indexOfSpace;
    indexOfSpace = txt.indexOf(' ',indexOfSpace+1);

    
    if (indexOfSpace == -1) this.setText(txt);
    else this.setText(txt.substring(0,indexOfSpace));
    this.updateText();

    if (this.width > max_width) {

      if (prevIndexOfSpace == 0 && indexOfSpace == -1) {
        txtArray.push(txt);
        txt = '';
        indexOfSpace = 0;
        continue;
      }

      if (prevIndexOfSpace == 0) {
        txtArray.push(txt.substring(0,indexOfSpace));
        txt = txt.substring(indexOfSpace+1);
        indexOfSpace = 0;
        continue;
      }

      txtArray.push(txt.substring(0,prevIndexOfSpace));
      txt = txt.substring(prevIndexOfSpace+1);
      indexOfSpace = 0;


    }else {
      //ostatnia linijka nie za dluga
      if (indexOfSpace == -1) {
        txtArray.push(txt);
        txt = '';
      } 

    }
  
  }


  this.setText(txtArray.join('\n'));


};



G.MultiLineText.prototype.popUpAnimation = function() {
  
  this.cacheAsBitmap = false;

  var char_numb = this.children.length;
 
  //
  var delay_array = [];
  for (var i = 0; i < char_numb; i++) {
    delay_array[i] = i;
  }
 
  delay_array = Phaser.ArrayUtils.shuffle(delay_array);
  delay_index = 0;
  this.activeTweens = 0;

  this.children.forEach(function(letter) {
 
      if (letter.anchor.x == 0) {
        letter.x = letter.x + (letter.width*0.5);
        letter.y = letter.y + letter.height;
        letter.anchor.setTo(0.5,1);
      }
      var target_scale = letter.scale.x;
      letter.scale.setTo(0,0);
      this.activeTweens++;
      var tween = game.add.tween(letter.scale)
        .to({x:target_scale*1.5,y:target_scale*1.5},200,Phaser.Easing.Quadratic.In,false,delay_array[delay_index]*25)
        .to({x:target_scale,y:target_scale},200,Phaser.Easing.Sinusoidal.In);
      tween.onComplete.add(function() {this.activeTweens--; if (this.activeTweens == 0) {if (this.alive) this.cacheAsBitmap = true;}},this);
      tween.start();
      delay_index++; 
    },this)
};
G.OneLineText = function(x,y,font,text,size,width,hAnchor,vAnchor) {  

  Phaser.BitmapText.call(this, game, G.l(x), G.l(y), font, text, G.l(size), G.l(width));

  if (width) {
      while (this.width > G.l(width)) {
        this.fontSize -= 2;
        this.updateText();
        if (this.fontSize < 5) break;
      }
  }


  this.orgFontSize = G.l(size);

  this.maxUserWidth = G.l(width);

  
  this.skipCaching = G.skipOneLineTextCaching || false;

  this.hAnchor = hAnchor;
  this.vAnchor = vAnchor;

  this.anchor.setTo(this.hAnchor,this.vAnchor);
  this.updateText();


  this.insertCoin(this.fontSize);

  if (!this.skipCaching) {
    this.cacheAsBitmap = true;
    this.updateCache();
  }

  

  //this._cachedSprite.anchor.setTo(typeof this.hAnchor == 'undefined' ? 0.5 : this.hAnchor,this.vAnchor || 0);

  //this.x -= Math.floor(this.width*0.5);


};


G.OneLineText.prototype = Object.create(Phaser.BitmapText.prototype);
G.OneLineText.prototype.constructor = G.OneLineText;

G.OneLineText.prototype.insertCoin = function(size) {


  if (this.text.indexOf('$$') == -1) return;


  this.children.forEach(function(element,index,array) {

    if (!element.name) return;

    if (element.name == "$" && element.visible) {
      if (index+1 <= array.length-1 && array[index].name == '$') {

        var el = element;
        var el2 = array[index+1];

        el.visible = false;
        el2.visible = false;
        coin = G.makeImage(el.x+(size*0.05),el.y-(size*0.05),'coin');
        coin.width = size;
        coin.height = size;
        el.parent.addChild(coin);


      }
    }


  });

} 


G.OneLineText.prototype.setText = function(text) {

  Phaser.BitmapText.prototype.setText.call(this,text.toString());

  var oldScaleX = this.scale.x;
  var oldScaleY = this.scale.y;
  var oldAlpha = this.alpha;
  var oldAngle = this.angle;

  this.alpha = 1;
  this.scale.setTo(1);


  if (this.maxUserWidth) {
    this.fontSize = this.orgFontSize;
    this.updateText();
    var i = 0;
    while (this.width > this.maxUserWidth) {
      this.fontSize -= 1;

      this.updateText();
      if (this.fontSize < 5) break;
    }
  }

  if (!this.skipCaching && this.cacheAsBitmap) this.updateCache();

  this.scale.setTo(oldScaleX,oldScaleY);
  this.alpha = oldAlpha;
  this.angle = oldAngle;
  //this._cachedSprite.anchor.setTo(this.hAnchor || 0.5,1);

};


G.OneLineText.prototype.popUpAnimation = function() {
  
  this.cacheAsBitmap = false;

  var char_numb = this.children.length;
 
  //
  var delay_array = [];
  for (var i = 0; i < char_numb; i++) {
    delay_array[i] = i;
  }
 
  delay_array = Phaser.ArrayUtils.shuffle(delay_array);
  delay_index = 0;
  this.activeTweens = 0;

  this.children.forEach(function(letter) {
 
      if (letter.anchor.x == 0) {
        letter.x = letter.x + (letter.width*0.5);
        letter.y = letter.y + letter.height;
        letter.anchor.setTo(0.5,1);
      }
      var target_scale = letter.scale.x;
      letter.scale.setTo(0,0);
      this.activeTweens++;
      var tween = game.add.tween(letter.scale)
        .to({x:target_scale*1.5,y:target_scale*1.5},200,Phaser.Easing.Quadratic.In,false,delay_array[delay_index]*25)
        .to({x:target_scale,y:target_scale},200,Phaser.Easing.Sinusoidal.In);
      tween.onComplete.add(function() {this.activeTweens--; if (this.activeTweens == 0) {if (this.alive && !this.skipCaching) this.cacheAsBitmap = true;}},this);
      tween.start();
      delay_index++; 
    },this)
};

G.OneLineText.prototype.scaleOut = function(onComplete,context) {
  this.cacheAsBitmap = false;

  this.activeTweens = 0;


  this.children.forEach(function(letter,index) {

      if (letter.anchor.x == 0) {
        letter.x = letter.x + letter.width*0.5;
        letter.y = letter.y + letter.height*0.5;
        letter.anchor.setTo(0.5,0.5);
      }
      this.activeTweens++;
      letter.scale.setTo(letter.scale.x,letter.scale.y);

      var tween = game.add.tween(letter.scale)
        .to({x:0,y:0},400,Phaser.Easing.Cubic.In,false,index*20);
      tween.onComplete.add(function() {
        this.activeTweens--;
        if (this.activeTweens == 0) {this.destroy()}
       },this);
      tween.start();
    },this)

}





G.OneLineCounter = function(x,y,font,amount,size,width,hAnchor,vAnchor,preText,postText) {
  
  G.OneLineText.call(this,x,y,font,'',size,width,hAnchor,vAnchor);

  this.amount = amount;
  this.amountDisplayed = amount;
  this.amountMaxInterval = 5;
  this.amountMaxNegInterval = -5;

  this.absoluteDisplay = false;
  this.fixedToDecimal = 0;

  this.stepCurrent = 0;
  this.step = 0;

  this.preText = preText || '';
  this.postText = postText || '';

  this.setText(this.preText+amount+this.postText);

};

G.OneLineCounter.prototype = Object.create(G.OneLineText.prototype);

G.OneLineCounter.prototype.update = function() {

  if (this.lerp){
    this.lerpUpdate();
    return;
  }
  
  if (this.amountDisplayed != this.amount && this.stepCurrent-- <= 0) {
    this.stepCurrent = this.step;
  
    if (this.amountDisplayed != this.amount) {

      var diff = this.amount - this.amountDisplayed;

      this.amountDisplayed += game.math.clamp(diff,this.amountMaxNegInterval,this.amountMaxInterval);


      var valueToDisplay = this.amountDisplayed;

      if (this.absoluteDisplay) {valueToDisplay = Math.abs(valueToDisplay)};
      if (this.fixedTo != 0) {valueToDisplay = valueToDisplay.toFixed(this.fixedToDecimal)};

      this.setText(this.preText+valueToDisplay+this.postText);

    } 

  }

};

G.OneLineCounter.prototype.changeAmount = function(amount) {
  this.amount = amount;
};

G.OneLineCounter.prototype.increaseAmount = function(change) {
  this.amount += change;
};

G.OneLineCounter.prototype.changeIntervals = function(max,maxNeg) {

  if (typeof maxNeg == 'undefined') {
    this.amountMaxInterval = max;
    this.amountMaxNegInterval = -max;
  }else {
    this.amountMaxInterval = max;
    this.amountMaxNegInterval = maxNeg;
  }

} 

G.OneLineCounter.prototype.lerpUpdate = function(){

  if (this.amountDisplayed != this.amount && this.stepCurrent-- <= 0){
    this.stepCurrent = this.step;
    this.amountDisplayed = Math.round(G.lerp(this.amountDisplayed,this.amount,0.5,0.6));
    this.setText(this.amountDisplayed.toString());

  }

};
G.PartCacher = function() {

	Phaser.Group.call(this,game);
	
	this.active = false;	
	
	this.every = 1;

	this.rt = game.add.renderTexture(10,10);

	this.frameCounter = 0;

	this.framesToRecord = null;

};

G.PartCacher.prototype = Object.create(Phaser.Group.prototype);

G.PartCacher.prototype.update = function() {

	if (!this.active) return;

	this.stepForward();

	if (!this.checkChildren()) {
		this.active = false;
		this.removeAll(true,true);
		return;
	}

	if (this.frameCounter % this.frameRate === 0) {
		this.saveFrame();
		this.frameNr++;

		if (this.framesToRecord !== null){
			this.framesToRecord--;
			if (this.framesToRecord == 0) this.active = false;
		}

	}
	this.frameCounter++;

};

G.PartCacher.prototype.stepForward = function() {
	
	for (var i = this.children.length; i--; ) {
		this.children[i].update();
	}

};

G.PartCacher.prototype.start = function(fileName,frameRate,nrOfFrames){ 

	this.fileName = fileName;
	this.frameNr = 0;
	this.frameRate = 60/frameRate;
	this.active = true;
	this.frameCounter = 0;

	this.framesToRecord = nrOfFrames || null;

};

G.PartCacher.prototype.saveFrame = function() {

	var bounds = this.getBounds();

  var widthFromCenter = Math.max(this.x-bounds.x,bounds.x+bounds.width-this.x,400);
  var heightFromCenter = Math.max(this.y-bounds.y,bounds.y+bounds.height-this.y,400);
  this.rt.resize(widthFromCenter*2, heightFromCenter*2, true);
  this.rt.renderXY(this, widthFromCenter, heightFromCenter, true);

  var c = this.rt.getCanvas();
  var fileName = this.fileName+'_'+this.frameNr;

  c.toBlob(function(blob) {
    saveAs(blob, fileName);
	});

};

G.PartCacher.prototype.checkChildren = function() {

	var inactive = this.children.filter(function(child) {
		return !child.alive || child.alpha === 0 || child.scale.x == 0 || child.scale.y == 0; 
	});

	return this.children.length !== inactive.length;

};
G.PoolGroup = function(elementConstructor,argumentsArray,signal,initFill) {
	
	Phaser.Group.call(this,game);

	this._deadArray = [];
	this._elementConstructor = elementConstructor;
	this._argumentsArray = argumentsArray || [];
	this._argumentsArray.unshift(null);

	if (signal) {
		G.sb(signal).add(this.init,this);
	}

	if (initFill) {
		for (var i = 0; i < initFill; i++){
			element = new (Function.prototype.bind.apply(this._elementConstructor, this._argumentsArray));
			this.add(element);
			element.events.onKilled.add(this._onElementKilled,this);
			element.kill();

		}
	}

}

G.PoolGroup.prototype = Object.create(Phaser.Group.prototype);

G.PoolGroup.prototype.getFreeElement = function() {
	
	var element;

	if (this._deadArray.length > 0) {
		 element = this._deadArray.pop()
	}else {
		element = new (Function.prototype.bind.apply(this._elementConstructor, this._argumentsArray));
		element.events.onKilled.add(this._onElementKilled,this);
	}

	this.add(element);
	return element;

};

G.PoolGroup.prototype._onElementKilled = function(elem) {
	if (this !== elem.parent) return;
	this._deadArray.push(elem);
	this.removeChild(elem)

};

G.PoolGroup.prototype.init = function() {

	var elem = this.getFreeElement();
	elem.init.apply(elem,arguments);

	return elem;

};

G.PoolGroup.prototype.initBatch = function(nr) {

	for (var i = 0; i < nr; i++) {
		this.init.apply(this,[].slice.call(arguments,1));
	}

};
G.PreloaderBar = function(){
	
	Phaser.Group.call(this,game);
	this.fixedToCamera = true;

	this.softgamesBtn = game.add.button(0,200,'sg_logo',function(){
		SG_Hooks.triggerMoreGames();
	},this);
	this.softgamesBtn.anchor.setTo(0.5,0.5);
	this.add(this.softgamesBtn);

	this.gfx = game.add.graphics();
	this.add(this.gfx);
	this.drawProgress(0);

	G.sb('onScreenResize').add(this.onResize,this);
	this.onResize();

	game.load.onFileComplete.add(this.drawProgress,this);

};

G.PreloaderBar.prototype = Object.create(Phaser.Group.prototype);

G.PreloaderBar.prototype.onResize = function(){

	this.cameraOffset.x = game.width*0.5;
	this.cameraOffset.y = game.height*0.4;

};

G.PreloaderBar.prototype.drawProgress = function(progress){

	this.gfx.clear();
	this.gfx.lineStyle(2,0xffffff,1);
	this.gfx.beginFill(0x000000,1);
	this.gfx.drawRect(-150,0,300,50);
	this.gfx.beginFill(0xffffff,1);
	this.gfx.drawRect(-145,5,(progress/100)*290,40);

};
G.ProgressBar = function(x,y,sprite,currentValue,maxValue,offsetX,offsetY) {

	G.Image.call(this,x,y,sprite+'_empty',0,null);

	offsetX = typeof offsetX === 'undefined' ? 0 : offsetX;
	offsetY = typeof offsetY === 'undefined' ? 0 : offsetX;

	this.fill = G.makeImage(offsetX,offsetY,sprite+'_full',0,this);
	this.fillFullWidth = this.fill.width;

	this.fillOverlay = G.makeImage(offsetX,offsetY,sprite+'_full_overlay',this.fill,this);
	this.fillOverlay.alpha = 0;

	this.fill.cropRect = new Phaser.Rectangle(0,0,0,this.fill.height);	
	this.fill.updateCrop();

	this.currentValue = currentValue;
	this.prevCurrentValue = currentValue;

	this.targetValue = currentValue;

	//var used for lerp (so lerp dont stuck, because current value will be rounded)
	this.maxValue = maxValue;

	this.lerpValue = 0.05;

	this.updateBarCrop();

	this.onTargetReached = new Phaser.Signal();
	this.onBarFilled = new Phaser.Signal();

};

G.ProgressBar.prototype = Object.create(G.Image.prototype);

G.ProgressBar.prototype.update = function() {

	if (this.currentValue !== this.targetValue) {
		this.currentValue = G.lerp(this.currentValue,this.targetValue,this.lerpValue,this.maxValue*0.005);
		if (this.currentValue === this.targetValue) {
			this.onTargetReached.dispatch();
		}
	}

	if (this.currentValue !== this.prevCurrentValue) {
		this.updateBarCrop();

		if (this.currentValue === this.maxValue) {
			game.add.tween(this.fillOverlay).to({alpha:1},300,Phaser.Easing.Sinusoidal.InOut,true,0,0,true);
			this.onBarFilled.dispatch();
			if (this.label) {
				game.add.tween(this.label).to({alpha:0},600,Phaser.Easing.Sinusoidal.InOut,true);
			}
		}

		if (this.label) {
			if (Math.floor(this.currentValue) !== Math.floor(this.prevCurrentValue)) {
				console.log('updating label');
				this.label.updateValue(Math.floor(this.currentValue));
			}
		}

	}


	this.prevCurrentValue = this.currentValue;

};

G.ProgressBar.prototype.updateBarCrop = function() {

	var oldCropRectWidth = this.fill.cropRect.width;
	var newCropRectWidth = Math.round(this.fillFullWidth*(this.currentValue/this.maxValue));

	if (oldCropRectWidth !== newCropRectWidth) {
		this.fill.cropRect.width = newCropRectWidth;
		this.fill.updateCrop();
	}

};

G.ProgressBar.prototype.changeCurrentValue = function(newTargetValue,lerpValue) {

	this.targetValue = game.math.clamp(newTargetValue,0,this.maxValue);
	this.lerpValue = lerpValue || this.lerpValue;

};

G.ProgressBar.prototype.increaseCurrentValue = function(amount) {

	this.changeCurrentValue(this.targetValue+(amount || 1));

};

G.ProgressBar.prototype.decreaseCurrentValue = function(amount) {

	this.changeCurrentValue(this.targetValue-(amount || 1)); 

};

G.ProgressBar.prototype.changeValues = function(currentValue,maxValue) {

	this.currentValue = currentValue;
	this.prevCurrentValue = currentValue;
	this.targetValue = currentValue;
	this.maxValue = maxValue;

	if (this.label) {
		this.label.changeValues(currentValue,maxValue);
	}

	this.updateBarCrop();

};

G.ProgressBar.prototype.addLabel = function(labelType,animationOnIncrease) {

	this.label = new G.ProgressBar.Label(G.rl(this.width*0.5),G.rl(this.height*0.5),this.currentValue,this.maxValue,Math.floor(G.rl(this.height)*0.6),G.rl(this.width*0.7),labelType,animationOnIncrease);
	this.add(this.label);

};

//
// label types:
// 0 - current/max
// 1 - 20 left
//
G.ProgressBar.Label = function(x,y,currentValue,maxValue,size,maxWidth,labelType,animationOnIncrease) {

	G.OneLineText.call(this,x,y,'font','',size,maxWidth,0.5,0.5);

	this.labelType = labelType || 0;
	this.labelType1Text = G.txt('%AMOUNT% left');
	this.currentValue = currentValue;
	this.maxValue = maxValue;
	this.animationOnIncrease = animationOnIncrease || false;

	this.updateValue(this.currentValue,true);
};

G.ProgressBar.Label.prototype = Object.create(G.OneLineText.prototype);

G.ProgressBar.Label.prototype.updateValue = function(newCurrentValue,init) {

	if (!init && Math.min(newCurrentValue,this.maxValue) === this.currentValue) return;

	this.currentValue = newCurrentValue;

	this.updateLabelText();

	if (!init && this.animationOnIncrease) {
		G.stopTweens(this);
		this.scale.setTo(1);
		game.add.tween(this.scale).to({x:1.2,y:1.2},200,Phaser.Easing.Sinusoidal.InOut,true,0,0,true);
	}

};

G.ProgressBar.Label.prototype.changeValues = function(currentValue,maxValue) {

	this.currentValue = currentValue;
	this.maxValue = maxValue;
	this.alpha = this.currentValue < this.maxValue ? 1 : 0;
	this.updateLabelText();

};

G.ProgressBar.Label.prototype.updateLabelText = function() {

	if (this.labelType == 0) {
		this.setText(this.currentValue+'/'+this.maxValue);
	}else {
		this.setText(this.labelType1Text.replace('%AMOUNT%',(this.maxValue-this.currentValue)));
	}

};
if (typeof G == 'undefined') G = {};


G.SignalBox = (function() {

    //add permanents signal functionality
    if (!Phaser.Signal.prototype.addPermanent) {

        Phaser.Signal.prototype.addPermanent = function() {
            var signalBinding = this.add.apply(this,arguments);
            signalBinding._PERMANENT = true;
            return signalBinding;
        };

        Phaser.Signal.prototype.removeNonPermanent = function () {
            if (!this._bindings)
            {
                return;
            }

            var n = this._bindings.length;

            while (n--)
            {
                    if (!this._bindings[n]._PERMANENT)
                    {
                        this._bindings[n]._destroy();
                        this._bindings.splice(n, 1);
                    }
            }
        };
    };

    var clearOnStageChange = false;
    var signals = {};

    function clearNonPermanent() {
        Object.keys(signals).forEach(function(signal) {
            signals[signal].removeNonPermanent();
        });
    };

    function clearAll() {
        Object.keys(signals).forEach(function(signal) {
            signals[signal].removeAll();
        });
    };

    function getSignal(signalName) {

        if (!clearOnStageChange) {
            game.state.onStateChange.add(clearNonPermanent,this);
        }

        if (!signals[signalName]) {
            signals[signalName] = new Phaser.Signal();
        }

        return signals[signalName];

    };

    getSignal.signals = signals;
    getSignal.clearNonPermanent = clearNonPermanent;
    getSignal.clearAll = clearAll;

    return getSignal;



})();


G.Slider = function(x,y,width,initPos) {

	Phaser.Graphics.call(this,game,x,y);

	this.sliderWidth = width;
	this.pos = initPos;

	this.beginFill(0x000000,1);
	this.drawRect(0,-2,this.sliderWidth,4);

	this.circleGfx = this.addChild(game.make.graphics(width*initPos,0));
	this.circleGfx.clear();
	this.circleGfx.lineStyle(1, 0x000000, 1);
	this.circleGfx.beginFill(0x999999,1);
	this.circleGfx.drawCircle(0,0,32);
	this.circleGfx.sliderWidth = width;

	this.circleGfx.inputEnabled = true;
	this.circleGfx.input.useHandCursor = true;
	this.circleGfx.input.draggable = true;
	this.circleGfx.input.setDragLock(true, false);


};

G.Slider.prototype = Object.create(Phaser.Graphics.prototype);

G.Slider.prototype.update = function() {

	this.circleGfx.x = game.math.clamp(this.circleGfx.x,0,this.sliderWidth);
	this.pos = this.circleGfx.x/this.sliderWidth;

};
G.SliderPanel = function(x,y,width,height,content,config) {

	Phaser.Group.call(this,game);

	this.sliderWidth = G.l(width);
	this.sliderHeight = G.l(height);

	this.x = x + (this.sliderWidth*-0.5);
	this.y = y + (this.sliderHeight*-0.5);

	//slider mask
	this.gfxMask = game.add.graphics();
	
	this.gfxMask.beginFill(0x000000,1);
	this.gfxMask.drawRect(0,0,width,height);
	
	this.clickableObjects = [];

	this.config = config;
	this.applyConfig(this.config);

	this.addContent(content);
	this.add(this.gfxMask);
	//this.contentGroup.add(this.gfxMask);
	this.contentGroup.mask = this.gfxMask;

	this.slideY = 0;

	

	this.inputSprite = G.makeImage(0,0,null,0,this);
	this.inputSprite.inputEnabled = true;
	this.inputSprite.hitArea = new Phaser.Rectangle(0,0,width,height);

	this.inputSpriteDown = false;

	this.inputData = {
		x: null,
		y: null,
		velX: 0,
		velY: 0,
		xStart: null,
		yStart: null,
		startFrameStamp: null,
		clickDistanceWindow: 10,
		clickTimeWindow: 10,

	};

	//blocks input from buttons bellow
	this.inputSprite.events.onInputDown.add(function(pointer) {
		var p = game.input.activePointer;
		this.inputSpriteDown = true;
		this.inputData.x = this.inputData.xStart = p.worldX;
		this.inputData.y = this.inputData.yStart = p.worldY;
		this.inputData.startFrameStamp = this.frameCounter;
	},this);

	this.inputSprite.events.onInputUp.add(function() {
		var p = game.input.activePointer;
		this.inputSpriteDown = false;
		
		var distance = game.math.distance(this.inputData.xStart,this.inputData.yStart,p.worldX,p.worldY);
		var timeDelta = this.frameCounter - this.inputData.startFrameStamp;

		if (distance <= this.inputData.clickDistanceWindow && timeDelta <= this.inputData.clickTimeWindow) {
			this.propagateClick(p.x,p.y);
			this.inputData.velX = 0;
			this.inputData.velY = 0;
		}

	},this);

	//frameCounter for measuring click window
	//if I would use timestamps during low fps buttons could not work
	this.frameCounter = 0;

};

G.SliderPanel.prototype = Object.create(Phaser.Group.prototype);

G.SliderPanel.prototype.applyConfig = function(config) {

	this.horizontal = config.horizontal || false;
	this.horizontalLerp = config.horizontalLerp || false;
	this.vertical = config.vertical || true;
	this.verticalLerp = config.verticalLerp;

};

//group is at 0,0;
G.SliderPanel.prototype.addContent = function(group) {

	this.changeInputSettings(group);

	this.contentGroup = group;
	this.add(group);
	this.contentGroup.x = 0;

	this.contentGroupMinY = -this.contentGroup.height+this.sliderHeight;
	this.contentGroupMaxY = 0;
	this.contentGroupMinX = this.sliderWidth-this.contentGroup.width;
	this.contentGroupMaxX = 0;


};

//we have to change input settings, because buttons that are not visible
//are not covered by input sprite and they would be clickable
G.SliderPanel.prototype.changeInputSettings = function(group) {

	for (var i = group.children.length; i--; ) {
		var child = group.children[i];
		if (child.inputEnabled) {
			this.clickableObjects.push(child);
			child.inputEnabled = false;
		}
		if (child.children.length > 0) {
				this.changeInputSettings(child);
		}
	}

};

G.SliderPanel.prototype.update = function() {

	this.frameCounter++;

	if (this.inputSpriteDown && game.input.activePointer.isDown) {

		var difX = this.inputData.x - game.input.activePointer.worldX;
		var difY = this.inputData.y - game.input.activePointer.worldY;

		this.inputData.x = game.input.activePointer.worldX;
		this.inputData.y = game.input.activePointer.worldY;

		this.inputData.velX = 0.8 * (difX) + 0.2 * this.inputData.velX;
		this.inputData.velY = 0.8 * (difY) + 0.2 * this.inputData.velY;

		if (this.horizontal) {
			this.contentGroup.x -= this.inputData.velX;
		}

		if (this.vertical) {
			this.contentGroup.y -= this.inputData.velY;
		}

	}else {

		if (this.horizontal) {
			this.contentGroup.x -= this.inputData.velX;
			this.inputData.velX *= 0.95;
			if (Math.abs(this.inputData.velX) < 1) {
				this.inputData.velX = 0;
			}
		}

		if (this.vertical) {
			this.contentGroup.y -= this.inputData.velY;
			this.inputData.velY *= 0.95;
			if (Math.abs(this.inputData.velY) < 1) {
				this.inputData.velY = 0;
			}
		}
		
	}

	if (this.vertical) {
		this.boundRestrict('y',this.verticalLerp,this.contentGroupMinY,this.contentGroupMaxY);
	}

	if (this.horizontal) {
		this.boundRestrict('x',this.horizontalLerp,this.contentGroupMinX,this.contentGroupMaxX);
	}

	this.boundRestrict();
	

};

G.SliderPanel.prototype.propagateClick = function(pX,pY) {

	for (var i = 0; i < this.clickableObjects.length; i++) {
		if (this.clickableObjects[i].visible && this.clickableObjects[i].getBounds().contains(pX,pY)) {
			this.clickableObjects[i].onInputDown.dispatch();
			break;
		}
	}

};


G.SliderPanel.prototype.boundRestrict = function(prop,lerp,min,max) {

	if (lerp) {
		
		if (this.contentGroup[prop] > max) {
			this.contentGroup[prop] = G.lerp(this.contentGroup[prop],max,0.5);
			if (this.contentGroup[prop] < max+1 ) {
				this.contentGroup[prop] = max;
			}
		}

		if (this.contentGroup[prop] < min) {
			this.contentGroup[prop] = G.lerp(this.contentGroup[prop],min,0.2);
			if (this.contentGroup[prop] > min-1) {
				this.contentGroup[prop] = min;
			}
		}

	}else {

		this.contentGroup[prop] = game.math.clamp(this.contentGroup[prop],min,max);

	}

};
G.StrObjGroup = function(x,y,importObj){
	
	Phaser.Group.call(this,game);

	this.x = x || 0;
	this.y = y || 0;

	this.importObj = typeof importObj === 'string' ? JSON.parse(importObj) : importObj;

	this.parseImportObj(this.importObj);

};

G.StrObjGroup.prototype = Object.create(Phaser.Group.prototype);

G.StrObjGroup.prototype.parseImportObj = function(importObj){

	for (var i = 0; i < importObj.length; i++){

		var chunk = importObj[i];

		var img = G.makeImage(chunk.x,chunk.y,chunk.frame,chunk.anchor,this);
		img.scale.setTo(chunk.scale[0],chunk.scale[1]);
		img.angle = chunk.angle;

	}	

};
G.Text = function(x,y,txt,style,anchor,maxWidth,maxHeight,textWrap,align){

	if (typeof style !== 'object'){
		style = JSON.parse(JSON.stringify(G.Text.styles[style]));
	}

	this.userMaxWidth = maxWidth || Infinity;
	this.userMaxHeight = maxHeight || Infinity;

	if (textWrap){
		style.wordWrap = true;
		style.wordWrapWidth = maxWidth;
		style.align = align || 'left';
	}

	Phaser.Text.call(this,game,x,y,txt,style);

	if (anchor) {
    if (typeof anchor == 'number') { 
        this.anchor.setTo(anchor);
    }else {
        this.anchor.setTo(anchor[0],anchor[1]);
    }
  }

	this.width = Math.min(this.width,this.userMaxWidth);
	this.height = Math.min(this.height,this.userMaxHeight);

	

};

G.Text.prototype = Object.create(Phaser.Text.prototype);

G.Text.styles = {};

G.Text.addStyle = function(name,obj){
	G.Text.styles[name] = obj;
};

G.Text.prototype.setText = function(txt){

	Phaser.Text.prototype.setText.call(this,txt);
	this.scale.setTo(1);
	this.width = Math.min(this.width,this.userMaxWidth);
	this.height = Math.min(this.height,this.userMaxHeight);

};


G.TextCounter = function(x,y,amount,style,anchor,maxWidth,config){

	this.amount = amount;
	this.amountDisplayed = amount;

	G.Text.call(this,x,y,amount === null ? '...' : amount.toString(),style,anchor,maxWidth);

	config = config || {lerpValue: 0.5};

	//addConfig
	this.lerp = true;
	this.lerpValue = config.lerpValue;

	this.stepCurrent = 0;
	this.step = 0;

};

G.TextCounter.prototype = Object.create(G.Text.prototype);

G.TextCounter.prototype.setAmount = function(amount,immediately){

	this.amount = amount;
	if (immediately) {
		this.amountDisplayed = amount;
		this.setText(this.amountDisplayed.toString());
	}

};

G.TextCounter.prototype.changeAmount = function(change,immediately){

	this.amount += change;
	if (immediately) {
		this.amountDisplayed = this.amount;
		this.setText(this.amountDisplayed.toString());
	}

};

G.TextCounter.prototype.update = function(){

	if (this.amountDisplayed != this.amount && this.stepCurrent-- <= 0){
		this.stepCurrent = this.step;
		if (this.lerp) this.lerpUpdate();
	}

};

G.TextCounter.prototype.lerpUpdate = function(){

    this.amountDisplayed = (G.lerp(this.amountDisplayed,this.amount,this.lerpValue,0.2));
    this.setText(Math.round(this.amountDisplayed).toString());

};
G.TextRTCacher = function(){

};

G.TextRTCacher.prototype.cacheText = function(font,txt,fontSize,cacheLabel,tint){

	if (!this.txt){
		this.txt = game.make.bitmapText(0,0,font,'',80);
	}

	this.txt.fontSize = fontSize;
	this.txt.setText(txt);
	this.txt.tint = tint || 0xffffff;
	this.txt.updateCache();

	var rt = game.make.renderTexture(this.txt.width,this.txt.height,cacheLabel,true);
	rt.render(this.txt);

};

G.TextRTCacher.prototype.cachePhaserText = function(text,cacheLabel,style){

	var txt = game.make.text(0,0,text,style);
	var rt = game.make.renderTexture(txt.width,txt.height,cacheLabel,true);
	rt.render(txt);
	txt.destroy();

};
G.Timer = function(x,y,font,fontSize,maxWidth,anchorX,anchorY) {
	
	G.OneLineText.call(this,x,y,font,'???',fontSize,maxWidth,anchorX,anchorY);

	this.secLeft = 0;
	this.active = false;

	this.timerBinding = G.sb.onWallClockTimeUpdate.add(this.updateTimer,this);

	this.events.onDestroy.add(function() {
		this.timerBinding.detach();
	},this);

}

G.Timer.prototype = Object.create(G.OneLineText.prototype);


G.Timer.prototype.updateTimer = function() {

	if (!this.active) return;

	G.sfx.clock_tick.play();

	this.secLeft = Math.max(0,this.secLeft-1);
	this.setText(G.changeSecToTimerFormat(this.secLeft));

};

G.Timer.prototype.setSecLeft = function(secLeft) {

	this.secLeft = secLeft;
	this.setText(G.changeSecToTimerFormat(this.secLeft));

};

G.Timer.prototype.start = function(secLeft) {

	this.active = true;

};

G.TimerT = function(x,y,date,style,anchor,maxWidth,timerFormat,sfx) {
	
	G.Text.call(this,x,y,'???',style,anchor,maxWidth);

	this.secLeft = 0;
	this.active = false;
	this.timerFormat = timerFormat;

	this.dots = true;

	this.sfx = sfx ? G.sfx[sfs] : null;

	this.timerBinding = G.sb('onWallClockTimeUpdate').add(this.updateTimer,this);

	this.events.onDestroy.add(function() {
		this.timerBinding.detach();
	},this);

	if (date){
		this.setDate(date);
	}

}

G.TimerT.prototype = Object.create(G.Text.prototype);


G.TimerT.prototype.updateTimer = function() {

	if (!this.active) return;

	if (this.sfx) this.sfx.play();
	
	this.secLeft = Math.max(0,this.secLeft-1);

	this.updateTimerText(this.secLeft,this.dots);

	this.dots = !this.dots;

	// var dataArray = G.changeSecToDHMS(this.secLeft);

	// this.setText(G.changeSecToTimerFormat(this.secLeft));

};

G.TimerT.prototype.setSecLeft = function(secLeft) {

	this.secLeft = Math.max(0,secLeft);
	this.updateTimerText(this.secLeft,true);

};

G.TimerT.prototype.updateTimerText = function(secLeft,dots){

	var dataArray = G.changeSecToDHMS(this.secLeft);

	var txt = [];

	if (this.timerFormat.indexOf('d') > -1){
		txt.push(dataArray[0]);
	}

	if (this.timerFormat.indexOf('h') > -1){
		txt.push(dataArray[1]);
	}

	if (this.timerFormat.indexOf('m') > -1){
		txt.push(dataArray[2]);
	}

	if (this.timerFormat.indexOf('s') > -1){
		txt.push(dataArray[3]);
	}

	this.setText(txt.join(dots ? ':' : ' '));

};

G.TimerT.prototype.start = function(secLeft) {

	this.active = true;

};

G.TimerT.prototype.setDate = function(dateString){

	var ms = new Date(dateString).getTime();
	var now = Date.now();
	var diffSec = Math.ceil((ms-now)/1000);
	this.setSecLeft(diffSec);
	this.active = true;

};

G.UITargetParticles = function() {
	
	G.PoolGroup.call(this,G.UITargetParticle);
	this.fixedToCamera = true;

}

G.UITargetParticles.prototype = Object.create(G.PoolGroup.prototype);

G.UITargetParticles.prototype.initPart = function(x,y,sprite,targetObj,carriedValue,start){

	var part = this.init(x,y,sprite,targetObj,carriedValue);
	return part;
};


G.UITargetParticles.prototype.createDividedBatch = function(x,y,sprite,targetObj,amount,interval) {

	var batchObj = new G.UITargetParticles.BatchObj();

	var maxPartNr = maxPartNr || 25;
	var partNr = (amount/interval);
	if (partNr > maxPartNr){
		interval = Math.ceil(amount/maxPartNr);
	}

	var nrOfPartsInBatch = Math.floor(amount/interval)+Math.sign(amount % interval);

	for (var i = 0; i < nrOfPartsInBatch; i++) {
		var part = this.init(x,y,sprite,targetObj,Math.min(interval,amount));
		amount -= interval;
		batchObj.add(part);
	}

	return batchObj;

};

G.UITargetParticles.prototype.createBatch = function(x,y,sprite,targetObj,carriedValue,nrOfParts) {

	var batchObj = new G.UITargetParticles.BatchObj();

	var array = Array.isArray(x);

	for (var i = 0; i < nrOfParts; i++) {
		if (array){
			var part = this.init(x[i].x,x[i].y,sprite,targetObj,carriedValue);
		}else{
			var part = this.init(x,y,sprite,targetObj,carriedValue);
		}

		batchObj.add(part);
	}

	return batchObj;

};

G.UITargetParticles.BatchObj = function() {

	this.parts = [];
	this.nrOfParts = 0;
	this.nrOfFinished = 0;
	this.onFinish = new Phaser.Signal();

};

G.UITargetParticles.BatchObj.prototype.add = function(part) {

	this.parts.push(part);
	part.onFinish.addOnce(this.onPartFinish,this);
	this.nrOfParts++;

};

G.UITargetParticles.BatchObj.prototype.onPartFinish = function() {
	this.nrOfFinished++;
	if (this.nrOfFinished == this.nrOfParts) {
		this.onFinish.dispatch();
	}
};

G.UITargetParticles.BatchObj.prototype.addOnPartStart = function(func,context) {

	this.parts.forEach(function(part) {
		part.onStart.addOnce(func,context || part,1);
	});
	
};

G.UITargetParticles.BatchObj.prototype.addOnPartFinish = function(func,context) {
	
	this.parts.forEach(function(part) {
		part.onFinish.addOnce(func,context || part,1);
	});

};

G.UITargetParticles.BatchObj.prototype.start = function(delayBetween) {

	var delay = 0;
	this.parts.forEach(function(part) {
		part.start(delay);
		delay += delayBetween || 0;
	})

};





G.UITargetParticle = function() {

	G.Image.call(this,0,0,null,0.5);
	this.onStart = new Phaser.Signal();
	this.onFinish = new Phaser.Signal();
	
	this.speed = 0;
	this.speedMax = 30;
	this.speedDelta = 0.75;

	

	this.vel = new Phaser.Point(0,0);
	this.velInit = new Phaser.Point(0,0);

	this.kill();

};

G.UITargetParticle.prototype = Object.create(G.Image.prototype);

G.UITargetParticle.prototype.init = function(x,y,sprite,targetObj,carriedValue) {

	this.position.setTo(x,y);
	
	this.changeTexture(sprite);

	this.onStart.removeAll();
	this.onFinish.removeAll();

	this.carriedValue = carriedValue || 1;

	this.targetObj = targetObj;


	this.stopTweens(this);
	this.scale.setTo(1);
	this.alpha = 1;

	this.speed = 0;

	this.vel.setTo(0,0);

};

G.UITargetParticle.prototype.start = function(delay) {

	if (delay) {
		game.time.events.add(delay,this.start,this);
		return;
	}
	
	this.revive();
	
	this.onStart.dispatch(this,this.carriedValue);

};

G.UITargetParticle.prototype.update = function() {

	if (!this.alive) return;

	this.position.add(this.vel.x,this.vel.y);
	this.vel.x *= 0.95;
	this.vel.y *= 0.95;

	this.speed += this.speedDelta;
	this.speed = Math.min(this.speed,this.speedMax);

	var distanceToTarget = Phaser.Point.distance(this.worldPosition,this.targetObj.worldPosition);
	var angleToTarget = Phaser.Point.angle(this.targetObj.worldPosition,this.worldPosition);
	this.position.add( 
		G.lengthDirX(angleToTarget,Math.min(distanceToTarget,this.speed),true),
		G.lengthDirY(angleToTarget,Math.min(distanceToTarget,this.speed),true)
	);

	if (distanceToTarget < this.speedMax * 1.2) {
		this.onFinish.dispatch(this,this.carriedValue);
		this.kill();
	};

};
if (typeof G == 'undefined') G = {};

Math.sign = Math.sign || function(x) {
  x = +x; // convert to a number
  if (x === 0 || isNaN(x)) {
    return x;
  }
  return x > 0 ? 1 : -1;
}


G.isImageInCache = function(frameName) {

  var spritesheet = this.checkSheet(frameName)
  if (spritesheet != '') {
    return true;
  }else {
    return game.cache.checkImageKey(frameName);
  }

};


G.checkSheet = function(frame) {
  
  if (G.spritesheetMap) {
    return G.spritesheetMap[frame] || '';
  }else {
    return this.checkSheetOld();
  }

 
};

G.checkSheetOld = function() {
  for (var i = 0, len = G.ASSETS.spritesheets.length; i < len; i++) {
    var spritesheet = G.ASSETS.spritesheets[i];
      if (game.cache.checkImageKey(G.ASSETS.spritesheets[i]) && game.cache.getFrameData(G.ASSETS.spritesheets[i]).getFrameByName(frame)) {
          return G.ASSETS.spritesheets[i];
      }
  }
  return '';
};

G.lerp = function(valCurrent,valTarget,lerp,snapRange) {

  if (snapRange && Math.abs(valCurrent-valTarget) <= snapRange) {
    return valTarget;
  }

  return valCurrent+lerp*(valTarget-valCurrent);
};

G.l = function(value) {
  return Math.floor(value*G.Loader.currentConfigMulti); 
};

G.rl = function(value) {

  return Math.floor(value*(1/G.Loader.currentConfigMulti));  

};

G.lnf = function(value) {
  return value*G.Loader.currentConfigMulti; 
};

G.rnd = function(min,max) {
  return game.rnd.realInRange(min || 0,max || 1);
};

G.rndInt = function(min,max) {
  return game.rnd.between(min,max);
};

G.changeTexture = function(obj,image) {

  if (typeof image !== 'string'){
    //probalby texture file
    return obj.loadTexture(image);
  }

  var ssheet = this.checkSheet(image);

  if (ssheet == '') {
    obj.loadTexture(image);
  }else {
    obj.loadTexture(ssheet,image);
  };

};

G.txt = function(text) {

  if (!G.lang) G.lang = 'en';
  if (!G.json.languages[G.lang]) G.lang = 'en';
  return G.json.languages[G.lang][text] || text+'***';

};

G.deltaTime = 1;

G.delta = function() {

  G.deltaTime = Math.min(1.5,game.time.elapsedMS/16);
  if (game.time.elapsedMS == 17) G.deltaTime = 1;
};

G.rotatePositions = function(positions) {

  var result = [];

  for (var i = 0, len = positions.length; i < len; i+=2) {
    result.push(
      positions[i+1]*-1,
      positions[i]
    )
  }

  return result;

};

G.loadTexture = G.changeTexture;

G.makeImage = function(x,y,frame,anchor,groupToAdd) {
    
  var ssheet = this.checkSheet(frame);
  var image;

  if (ssheet == '') {
    image = game.make.image(this.l(x),this.l(y),frame);
  } else {
    image = game.make.image(this.l(x),this.l(y),ssheet,frame);
  }

  if (anchor) {
    if (typeof anchor == 'number') {
        image.anchor.setTo(anchor);
    }else {
        image.anchor.setTo(anchor[0],anchor[1]);
    }
  }

  if (groupToAdd) {
    (groupToAdd.add || groupToAdd.addChild).call(groupToAdd,image);
  }else if (groupToAdd !== null) {
    game.world.add(image);
  }

  return image;
};

G.capitalize = function(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

G.lengthDirX =  function(angle, length, rads) {
  var rads = rads || false;
  if (rads) {
    return Math.cos(angle) * length;
  }else {
    return Math.cos(game.math.degToRad(angle)) * length;
  }
};

G.lengthDirY = function(angle, length, rads) {
  var rads = rads || false;
  if (rads) {
    return Math.sin(angle) * length;
  }else {
    return Math.sin(game.math.degToRad(angle)) * length;
  }
};


G.stopTweens = function(obj) {

    game.tweens._add.forEach(function(tween) {
        if (obj.scale && tween.target == obj.scale) tween.stop();
        if (tween.target == obj) tween.stop();
    });

    game.tweens._tweens.forEach(function(tween) {
        if (obj.scale && tween.target == obj.scale) tween.stop();
        if (tween.target == obj) tween.stop();
    });
};


G.makeExtImage = function(x,y,url,waitImg,anchor,groupToAdd,tmp,func) {

  if (!G.extLoader) G.extLoader = new G.ExtLoader(game);

  var img;

  if (G.extLoader.loadedUrls[url]) {
    img = G.makeImage(x,y,G.extLoader.loadedUrls[url],anchor,groupToAdd);
    func.call(img);
    return img;
  }

  img = G.makeImage(x,y,waitImg,anchor,groupToAdd);
  img.onImgLoaded = new Phaser.Signal();
  
  if (!G.extImagesKeys) G.extImagesKeys = [];
  var name = 'extImgBlankName'+G.extImagesKeys.length;

  G.extImagesKeys.push(name);

  var binding = G.extLoader.onFileComplete.add(function(progress,key,success) {

    if (key == name && success) {

      G.extLoader.loadedUrls[url] = name;

      G.changeTexture(img,name);
      if (func) func.call(img);
      binding.detach();
    }
    
  });
  //game.load.start();

  G.extLoader.image(name, url, true);

  /*if (tmp) {
    G.extLoader.imagesToRemoveOnStateChange.push(name);
  }*/

  return img;

};


G.drawCircleSegment = function(gfx,x,y,radius,angleStart,angleFinish,segments) {

  if (angleStart === angleFinish)
  {
      return gfx;
  }

  if (segments === undefined) {segments = 10};

  var angleDiff = angleFinish-angleStart;
  var segDiff = angleDiff/segments;

  gfx.moveTo(x,y);
  var points = gfx.currentPath.shape.points;

  for ( ; angleStart <= angleFinish; angleStart+=segDiff) {
    points.push(
      Math.floor(x + G.lengthDirX(angleStart,radius,false)),
      Math.floor(y + G.lengthDirY(angleStart,radius,false))
    )
  };

  points.push(
      Math.floor(x + G.lengthDirX(angleFinish,radius,false)),
      Math.floor(y + G.lengthDirY(angleFinish,radius,false))
    )


  gfx.dirty = true;
  gfx._boundsDirty = true;

  return gfx;


};

G.centerElements = function(list,distanceList,center) {

  if (center === undefined) center = 0;
  if (distanceList === undefined) distanceList=[];

  var wholeWidth = 0;
  var isDistArray = Array.isArray(distanceList);

  list.forEach(function(e,i) {
    wholeWidth += e.width;
    if (isDistArray ? distanceList[i-1] : distanceList !== undefined) {
      wholeWidth+=G.l(isDistArray ? distanceList[i-1] : distanceList);
    }
  });

  var currentX = center + (wholeWidth*-0.5);

  list.forEach(function(e,i,a) {
    e.x = currentX;
    e.x += e.width*e.anchor.x;    

    currentX += e.width;
    if (isDistArray ? distanceList[i-1] : distanceList  !== undefined) {
      currentX += G.l(isDistArray ? distanceList[i] : distanceList);
    }
  });

};

G.centerElements2 = function(list,distance,center){

  if (center === undefined) center = 0;
  if (distance === undefined) distance = 0;

  var wholeWidth = 0;

  list.forEach(function(e,i){
    wholeWidth += e.width;
  });

  wholeWidth += distance * (list.length-1);

  list.forEach(function(e,i,l){
    if (i == 0){
      e.left = center+(wholeWidth*-0.5);
    }else{
      e.left = l[i-1].right + distance;
    }
  });

};


G.makeMover = function(obj) {

  if (G.activeMover !== undefined) {
    G.activeMover.destroy();
      G.activeMover.eKey.onDown.removeAll();
  }

  G.activeMover = game.add.image();
  G.activeMover.obj = obj;
  G.activeMover.cursors = game.input.keyboard.createCursorKeys();
  G.activeMover.shiftKey = game.input.keyboard.addKey(Phaser.Keyboard.SHIFT);
  G.activeMover.eKey = game.input.keyboard.addKey(Phaser.Keyboard.E);
  G.activeMover.eKey.onDown.add(function() {
      console.log("MOVER: "+this.obj.x+'x'+this.obj.y);
  },G.activeMover)

  G.activeMover.update= function() {

      var moveVal = this.shiftKey.isDown ? 10 : 2;

      if (this.cursors.down.isDown) {
        obj.y += moveVal;
      }   

       if (this.cursors.up.isDown) {
        obj.y -= moveVal;
      }

       if (this.cursors.left.isDown) {
        obj.x -= moveVal;
      }

       if (this.cursors.right.isDown) {
        obj.x += moveVal;
      }

  };

};


G.makeLineEditor = function(interpolation) {

  var be = game.add.group();

  be.interpolation = interpolation || 'linear';
  be.pointsX = [0];
  be.pointsY = [0];



  be.gfx = be.add(game.make.graphics());

  be.shiftKey = game.input.keyboard.addKey(Phaser.Keyboard.SHIFT);

  be.wKey = game.input.keyboard.addKey(Phaser.Keyboard.W);
  be.wKey.onDown.add(function(){

    var xx,yy;

    if (this.children.length > 2) {
      xx = this.children[this.children.length-1].x;
      yy = this.children[this.children.length-1].y;
    }else {
      xx = 0;
      yy = 0;
    }

    var newPoint  = G.makeImage(xx,yy,'candy_1');
    newPoint.anchor.setTo(0.5);
    newPoint.scale.setTo(0.1);
    this.add(newPoint);
    this.activeObject = newPoint;
    this.changed = true;
  },be);

  be.qKey = game.input.keyboard.addKey(Phaser.Keyboard.Q);
  be.qKey.onDown.add(function() {
    if (this.children.length <= 2) return;
    this.removeChildAt(this.children.length-1);
    if (this.children.length > 3) {
      this.activeObject = this.children[this.children.length-1];
    }else {
      this.activeObject = null;
    }
    this.changed = true;
  },be);


  be.aKey = game.input.keyboard.addKey(Phaser.Keyboard.A);
  be.aKey.onDown.add(function() {
    if (!this.activeObject) return;
    var index = this.getChildIndex(this.activeObject);
    if (index == 2) return;
    this.activeObject = this.getChildAt(index-1);
  },be);

  be.sKey = game.input.keyboard.addKey(Phaser.Keyboard.S);
  be.sKey.onDown.add(function() {
    if (!this.activeObject) return;
    var index = this.getChildIndex(this.activeObject);
    if (index == this.children.length-1) return;
    this.activeObject = this.getChildAt(index+1);
  },be);

  be.eKey = game.input.keyboard.addKey(Phaser.Keyboard.E);
  be.eKey.onDown.add(function() {
    console.log(JSON.stringify([this.pointsX,this.pointsY]));
  },be);


  be.cursors = game.input.keyboard.createCursorKeys();

  be.activeObject = null;

  be.preview = G.makeImage(0,0,'candy_2',0.5,be);
  be.preview.width = 8;
  be.preview.height = 8;
  be.preview.progress = 0;

  be.update = function() {

    if (this.activeObject === null) return;

    this.forEach(function(e) {
      if (e == this.activeObject) {
        e.alpha = 1;
      }else {
        e.alpha = 0.5;
      }
    },this)

    if (this.children.length == 0) return;

    var moveVal = this.shiftKey.isDown ? 3 : 1;

    if (this.cursors.down.isDown) {
      this.activeObject.y += moveVal;
      this.changed = true;
    }
    if (this.cursors.up.isDown) {
      this.activeObject.y -= moveVal;
      this.changed = true;
    }
    if (this.cursors.left.isDown) {
      this.activeObject.x -= moveVal;
      this.changed = true;
    }
    if (this.cursors.right.isDown) {
      this.activeObject.x += moveVal;
      this.changed = true;
    }


    be.preview.progress += 0.01;
    if (be.preview.progress > 1) be.preview.progress = 0;
    be.preview.x = game.math[this.interpolation+'Interpolation'](this.pointsX,be.preview.progress);
    be.preview.y = game.math[this.interpolation+'Interpolation'](this.pointsY,be.preview.progress);


    if (this.changed) {
      var pointsX = [];
      var pointsY = [];
      this.pointsX = pointsX;
      this.pointsY = pointsY;
      this.children.forEach(function(e,index) {
        if (index <= 1) return;
        pointsX.push(e.x);
        pointsY.push(e.y);
      });

      this.gfx.clear();
      this.gfx.beginFill(0xff0000,1);
      for (var i = 0; i < 200; i++) {
        this.gfx.drawRect(
          game.math[this.interpolation+'Interpolation'](pointsX,i/200),
          game.math[this.interpolation+'Interpolation'](pointsY,i/200),
          3,3
        );
      }
    }
  }


  return be;

};


G.lineUtils = {

  getWholeDistance: function(pointsX,pointsY){

    var wholeDistance = 0;
    for (var i  = 1; i < pointsX.length; i++) {
      wholeDistance += game.math.distance(pointsX[i-1],pointsY[i-1],pointsX[i],pointsY[i]);
    }
    return wholeDistance;

  },

  findPointAtDitance: function(pointsX,pointsY,dist) {

    var soFar = 0;
    for (var i = 1; i < pointsX.length; i++) {
      var currentDistance = game.math.distance(pointsX[i-1],pointsY[i-1],pointsX[i],pointsY[i]);
      if (currentDistance+soFar > dist) {
        var angle = game.math.angleBetween(pointsX[i-1],pointsY[i-1],pointsX[i],pointsY[i]);
        return [
          pointsX[i-1]+G.lengthDirX(angle,dist-soFar,true),
          pointsY[i-1]+G.lengthDirY(angle,dist-soFar,true)
        ]
      }else {
        soFar += currentDistance;
      } 

    }
    return [pointsX[pointsX.length-1],pointsY[pointsY.length-1]];

  },

  spreadAcrossLine: function(pointsX,pointsY,elementsList,propName1,propName2) {

     console.log("spreadAcrossLine");

    var wholeDistance = this.getWholeDistance(pointsX,pointsY);
    var every = wholeDistance/(elementsList.length-1);

    for (var i = 0; i < elementsList.length; i++) {
      var point = this.findPointAtDitance(pointsX,pointsY,every*i);
      elementsList[i][propName1 || 'x'] = point[0];
      elementsList[i][propName2 || 'y'] = point[1];   
    }
 
  },

  spreadOnNodes: function(pointsX,pointsY,elementsList,propName1,propName2) {

    console.log("SPREAD ON NODES");
    console.log(arguments);

    for (var i = 0; i < pointsX.length; i++) {
      console.log(i);
      if (typeof elementsList[i] === 'undefined') return;
      elementsList[i][propName1 || 'x'] = pointsX[i];
      elementsList[i][propName2 || 'y'] = pointsY[i]; 
      console.log(i + ' pos: '+pointsX[i]+'x'+pointsY[i]);     
    }

  }
};



G.changeSecToTimerFormat = function(sec,forceFormat) {

    var sec_num = parseInt(sec, 10); // don't forget the second param

    var fD = forceFormat ? forceFormat.toUpperCase().indexOf('D') !== -1 : false;
    var fH = forceFormat ? forceFormat.toUpperCase().indexOf('H') !== -1 : false;

    var days = Math.floor(sec_num / 86400);
    var hours   = Math.floor((sec_num - (days * 86400)) / 3600);
    var minutes = Math.floor((sec_num - (days * 86400) - (hours * 3600)) / 60);
    var seconds = sec_num - (days * 86400) - (hours * 3600) - (minutes * 60);


    var result = G.zeroPad(minutes)+':'+G.zeroPad(seconds);

    if (hours > 0 || days > 0 || fH){
      result = G.zeroPad(hours)+':'+result;
    }

    if (days > 0 || fD){
      result = G.zeroPad(days)+':'+result;
    }

    return result;

};

G.changeSecToDHMS = function(sec,forceFormat) {

    var sec_num = parseInt(sec, 10); // don't forget the second param

    var fD = forceFormat ? forceFormat.toUpperCase().indexOf('D') !== -1 : false;
    var fH = forceFormat ? forceFormat.toUpperCase().indexOf('H') !== -1 : false;

    var days = Math.floor(sec_num / 86400);
    var hours   = Math.floor((sec_num - (days * 86400)) / 3600);
    var minutes = Math.floor((sec_num - (days * 86400) - (hours * 3600)) / 60);
    var seconds = sec_num - (days * 86400) - (hours * 3600) - (minutes * 60);

    return [G.zeroPad(days),G.zeroPad(hours),G.zeroPad(minutes),G.zeroPad(seconds)];

};


G.zeroPad = function(number){
  return number < 10 ? "0" + number : number;
};

G.arrayJoin = function(array,marker) {

  return array.reduce(function(accumulator,currentVal) {

    if (currentVal) {

      if (accumulator) {
         return accumulator+marker+currentVal;
      }else {
         return currentVal;
      }

     
    }else {
      return accumulator;
    } 

  },'');


};

G.makeTextButton = function(x,y,text,style,func,context) {

  var txt = game.make.text(x,y,text,style)
  txt.inputEnabled = true;
  txt.input.useHandCursor = true;
  txt.hitArea = new Phaser.Rectangle(0,0,txt.width,txt.height);
  txt.events.onInputDown.add(func,context || null);

  return txt;

};

G.setObjProp = function(obj,prop,val){

  var currentObj = obj;
  if (typeof prop == 'string') {
    prop.split('.');
  }

  try {
    for (var i = 0; i < this.refreshProp.length-1; i++){
      currentObj = currentObj[this.refreshProp[i]];
    } 

    currentObj[this.refreshProp[this.refreshProp.length-1]] = val;
  }catch(e){
    console.warn('cant set prop');
    console.log(obj);
    console.log(prop);
  }


};

G.getObjProp = function(obj,prop){

  var current = obj;
    if (typeof prop == 'string') {
      prop = prop.split('.');
    }

    try {
      for (var i = 0; i < prop.length; i++){
        current = current[prop[i]];
      }
    } catch(e){
      return undefined;
    }

    return current;

};



if (typeof G == 'undefined') G = {};

G.Utils = {

  cacheText: function(cacheLabel,txt,font,fontSize,tint){

    var txt = game.make.bitmapText(0,0,font,txt,fontSize);
    txt.tint = tint || 0xffffff;
    txt.updateCache();

    var rt = game.make.renderTexture(txt.width,txt.height,cacheLabel,true);
    rt.render(txt);

    txt.destroy();

  },

  cacheGText: function(cacheLabel,txt,style){

    var txt = new G.Text(0,0,txt,style,0);
    var rt = game.make.renderTexture(txt.width,txt.height,cacheLabel,true);
    rt.render(txt);
    txt.destroy();

  },
  
  lerp: function(valCurrent,valTarget,lerp,snapRange) {
    if (snapRange && Math.abs(valCurrent-valTarget) <= snapRange) {
      return valTarget;
    }
    return valCurrent+lerp*(valTarget-valCurrent);
  },
  
  copyToClipboard: function(text){

    if (!this.copyArea) {
      this.copyArea = document.createElement("textarea");
      this.copyArea.style.positon = 'fixed';
      this.copyArea.style.opacity = 0;
      document.body.appendChild(this.copyArea);

    }

    this.copyArea.value = text;
    this.copyArea.select();
    document.execCommand('copy');

  },

  getObjProp: function(obj,prop){

    var current = obj;
    if (typeof prop == 'string') {
      prop = prop.split('.');
    }

    try {
      for (var i = 0; i < prop.length; i++){
        current = current[prop[i]];
      }
    } catch(e){
      return undefined;
    }

    return current;

  },

  setObjProp: function(obj,prop,val){

    var currentObj = obj;
    if (typeof prop == 'string') {
      prop = prop.split('.');
    }

    try {
      for (var i = 0; i < prop.length-1; i++){
        currentObj = currentObj[prop[i]];
      } 
      currentObj[prop[prop.length-1]] = val;
    }catch(e){
      return null;
    }

  },

  replaceAll: function(string,search,replacement){
    return string.split(search).join(replacement);
  },

  removeDuplicates: function(array){

    var result = [];

    array.forEach(function(elem){
      if (result.indexOf(elem) === -1) result.push(elem);
    });

    return result;
    
  },

  getParentsScaleX: function(obj,rec){

    if (obj == game.stage){
      return 1;
    }else{
      return G.Utils.getParentsScaleX(obj.parent,true)*(!rec ? 1 : obj.scale.x);
    }

  },

  getParentsScaleY: function(obj,rec){

    if (obj == game.stage){
      return 1;
    }else{
      return G.Utils.getParentsScaleY(obj.parent,true)*(!rec ? 1 : obj.scale.y);
    }

  },

  makeTextButton: function(x,y,label,func,context,style) {

    var txt = game.add.text(x,y,label,style);
    txt.inputEnabled = true;
    txt.input.useHandCursor = true;
    txt.hitArea = new Phaser.Rectangle(0,0,txt.width,txt.height);
    txt.events.onInputDown.add(func,context);
    return txt;

  },

  injectCSS: function(css){

    var style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = css;
    document.getElementsByTagName('head')[0].appendChild(style);

  },

  toClientX: function(ingameX){
    var marginLeft = parseInt(game.canvas.style.marginLeft) || 0;
    return marginLeft+(ingameX/game.width)*game.canvas.clientWidth;
  },

  toClientY: function(ingameY){
    var marginTop = parseInt(game.canvas.style.marginTop) || 0;
    return marginTop+(ingameY/game.height)*game.canvas.clientHeight;
  },

  clientXToWorldX: function(clientX){
    var marginLeft = parseInt(game.canvas.style.marginLeft) || 0;

    clientX -= marginLeft;
    var canvasStyleWidth = parseInt(game.canvas.style.width);
    var canvasStyleHeight = parseInt(game.canvas.style.height);
    var canvasContextWidth = parseInt(game.canvas.width);
    var canvasContextHeight = parseInt(game.canvas.height);

    var ratio = canvasContextWidth/canvasStyleWidth;

    return clientX*ratio;


  },

  clientYToWorldY: function(clientY){

    var marginTop = parseInt(game.canvas.style.marginTop) || 0;

    clientY -= marginTop;
    var canvasStyleWidth = parseInt(game.canvas.style.width);
    var canvasStyleHeight = parseInt(game.canvas.style.height);
    var canvasContextWidth = parseInt(game.canvas.width);
    var canvasContextHeight = parseInt(game.canvas.height);

    var ratio = canvasContextHeight/canvasStyleHeight;

    return clientY*ratio;

  },

  

  getImageURI: function(img){

    if (!this._bmpMarker) this._bmpMarker = G.makeImage(0,0,null,0,null);
    if (!this._bmp) this._bmp = game.make.bitmapData();

    this._bmp.clear();
    G.changeTexture(this._bmpMarker,img);
    this._bmp.resize(this._bmpMarker.width,this._bmpMarker.height);
    this._bmp.draw(this._bmpMarker);
    return this._bmp.canvas.toDataURL();
  },

  getRT: function(rtName){
    return game.cache.getRenderTexture(rtName).texture;
  },

  arraysEqual: function arraysEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length != b.length) return false;

    // If you don't care about the order of the elements inside
    // the array, you should sort both arrays here.

    for (var i = 0; i < a.length; ++i) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

};

G.lineCircleColl = function(LINE,C,point) {

  var A = LINE.start;
  var B = LINE.end;

  var LAB = Math.sqrt(Math.pow(B.x-A.x,2)+Math.pow(B.y-A.y,2))

  var Dx = (B.x-A.x)/LAB
  var Dy = (B.y-A.y)/LAB

  var t = Dx*(C.x-A.x) + Dy*(C.y-A.y)    

  var Ex = t*Dx+A.x
  var Ey = t*Dy+A.y

  var LEC = Math.sqrt(Math.pow(Ex-C.x,2)+Math.pow(Ey-C.y,2))

  if( LEC < C.radius )
  {
      
      var dt = Math.sqrt((C.radius*C.radius) - (LEC*LEC))

      var Fx = (t-dt)*Dx + A.x;
      var Fy = (t-dt)*Dy + A.y;

      var Gx = (t+dt)*Dx + A.x;
      var Gy = (t+dt)*Dy + A.y;

      var FtoLength = game.math.distance(A.x,A.y,Fx,Fy);
      var GtoLength = game.math.distance(A.x,A.y,Gx,Gy);

      if (FtoLength < GtoLength) {
        if (LINE.length > FtoLength) {
          point.setTo(Fx,Fy);
          return point;
        }else {
          return false;
        }
      }else {
        if (LINE.length > GtoLength) {
          point.setTo(Gx,Gy);
          return point;
        }else {
          return false;
        }
      }

  } else {
    return false;
  }

};

G.getRT = function(rtName){

  var rt = game.cache.getRenderTexture(rtName);
  if (!rt) return null;
  return rt.texture;
};


G.numberDot = function(price){

  price = price.toString();
  var result = '';

  var n = 0;
  for (var i = price.length-1; i >= 0; i--){
    result = price[i] + result;
    n++;
    if (n == 3 && i !== 0){
      result = '.' + result;
      n = 0;
    }
  }

  return result;

};


G.guid = function() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
};
G.AnimationElement = function(x,y,data,autoplay){

	G.Image.call(this,x,y,null);

	this.ANIMATIONELEMENT = true;

	//we need to have this element, so constructor act as wrapper
	//so it can be placed, rotated and scaled without affecting
	//values on timelines
	this.SPR = new G.Image(0,0,null,0.5,this); 

	this.frameCounter = 0;
	this.data = data;

	this.currentAnimationData = null;
	this.currentAnimationName = null;

	this.playing = autoplay === undefined ? true : autoplay;

};

G.AnimationElement.prototype = Object.create(G.Image.prototype);

G.AnimationElement.prototype.update = function(){

	if (!this.currentAnimationName) return;

	if (this.playing){
		this.frameCounter++;
		this.updateAnimation(this.frameCounter);
	}
	
};

G.AnimationElement.prototype.pause = function(){
	this.playing = false;
};

G.AnimationElement.prototype.resume = function(){
	this.playing = true;
};

G.AnimationElement.prototype.play = function(){
	this.playing = true;
};

G.AnimationElement.prototype.stop = function(){
	this.playing = false;
	this.updateAnimation(0);
};

/*G.AnimationElement.prototype.getTotalLength = function(){

	var len = Infinity;

	for (var i = 0; i < this.propKeys.length; i++){
		len = Math.min(
			this.propTLS[this.propKeys[0]].length,
			len
		);
	}

	len = Math.min(this.eventTL.length,len);

	return len;

};*/

/*
G.AnimationElement.prototype.init = function(dataInit){

	this.SPR.x = dataInit.x;
	this.SPR.y = dataInit.y;
	this.SPR.angle = dataInit.angle;
	this.SPR.scale.setTo(dataInit.scale[0],dataInit.scale[1]);
	this.SPR.changeTexture(dataInit.frame);
	this.SPR.anchor.setTo(dataInit.anchor[0],dataInit.anchor[1]);

};*/

var testObj = {
	normal: {
		eventTL: [],
		frameTL: [{f:0, v:'candy_1'}],
		propTLS: {
			alpha: [{f:0,v:1}],
			x: [{f:0,v:0}],
			y: [{f:0,v:0}],
			angle: [{f:0,v:0}],
			'scale.x': [{f:0,v:1}],
			'scale.y': [{f:0,v:1}],
			'anchor.x':  [{f:0,v:0.5}],
			'anchor.y':  [{f:0,v:1}]
		}
	},
	jump: {
		eventTL: [],
		frameTL: [{f:0, v:null}],
		propTLS: {
			alpha: [{f:0,v:1}],
			x: [{f:0,v:0}],
			y: [{f:0,v:0},{f:120,v:-300}],
			angle: [{f:0,v:0,e:['Linear','None']},{f:400,v:360}],
			'scale.x': [{f:0,v:1}],
			'scale.y': [{f:0,v:1}],
			'anchor.x':  [{f:0,v:0.5}],
			'anchor.y':  [{f:0,v:1}]
		}
	}
}

G.AnimationElement.prototype.changeAnimationData = function(animationName){

	if (!this.data[animationName]){
		animationName = Object.keys(this.data)[0];
	}

	this.eventTL = this.data[animationName].eventTL;
	this.frameTL = this.data[animationName].frameTL;
	this.propTLS = this.data[animationName].propTLS;
	this.propKeys = Object.keys(this.propTLS);
	this.currentAnimationData = this.data[animationName];
	this.currentAnimationName = animationName;
	this.updateAnimation(0);
	

};

G.AnimationElement.prototype.playAnimation = function(animationName){

	this.changeAnimationData(animationName);
	this.playing = true;

};

G.AnimationElement.prototype.getLastKeyFrame = function(tl,frameNr){

	var len = tl.length;
	for (var i = 0; i < len; i++){
		if (tl[i].f == frameNr || i == len-1) return tl[i];
		if (tl[i].f < frameNr && frameNr < tl[i+1].f){
			return tl[i];
		}
	};

};

G.AnimationElement.prototype.getNextKeyFrame = function(tl,frameNr){

	var len = tl.length;
	for (var i = 0; i < len; i++){
		if (tl[i].f > tl || i == len-1){
			return tl[i];
		}
	};

};

G.AnimationElement.prototype.getKeyFrameAt = function(tl,frameNr){

	if (!this.currentAnimationName) return null;

	for (var i = 0; i < tl.length; i++){
		var keyFrame = tl[i];
		if (keyFrame.f === frameNr) return keyFrame;
	}

	return null;
}

G.AnimationElement.prototype.isAnyKeyFrameAt = function(frameNr){

	if (!this.currentAnimationName) return false;

	if (this.getKeyFrameAt(this.eventTL,frameNr)) return true;
	if (this.getKeyFrameAt(this.frameTL,frameNr)) return true;

	for (var i = 0; i < this.propKeys.length; i++){
		var key = this.propKeys[i];
		if (this.getKeyFrameAt(this.propTLS[key],frameNr)) {
			return true;
		}
	}

	return false;

};

G.AnimationElement.prototype.getFrameValue = function(tl,frameNr){

	var lastKey = this.getLastKeyFrame(tl,frameNr);
	var nextKey = this.getNextKeyFrame(tl,frameNr);

	if (!lastKey.e){
		return lastKey.v;
	}else{
		var animLength = nextKey.f - lastKey.f;
		var valDiff = nextKey.v-lastKey.v;
		var easingVal = Phaser.Easing[lastKey.e[0]][lastKey.e[1]]((frameNr-lastKey.f)/animLength);
		return lastKey.v + (valDiff*easingVal);
	}

};


G.AnimationElement.prototype.updateAnimation = function(frameNr){

	if (!this.currentAnimationName) return;

	this.frameCounter = frameNr;

	this.updateFromPropTLS(frameNr);

	var frame = this.getTextureFrameValue(this.frameTL,frameNr);
	if (this.SPR.key != frame && this.SPR.frameName != frame){
		G.changeTexture(this.SPR,frame);
	}


}

G.AnimationElement.prototype.updateFromPropTLS = function(frameNr){

	for (var i = 0; i < this.propKeys.length; i++){
		var key = this.propKeys[i];
		this.setProp(key,this.getFrameValue(this.propTLS[key],frameNr));
	}

};

// lets make it a bit faster
G.AnimationElement.prototype.setProp = function(key,value){

	if (key == 'scale.x') this.SPR.scale.x = value;
	else if (key == 'scale.y') this.SPR.scale.y = value;
	else if (key == 'anchor.x') this.SPR.anchor.x = value;
	else if (key == 'anchor.y') this.SPR.anchor.y = value;
	else this.SPR[key] = value;

};


G.AnimationElement.prototype.getTextureFrameValue = function(tl,frameNr){

	var lastKey = this.getLastKeyFrame(tl,frameNr);

	var frameSkip = lastKey.frameSkip || 1;

	var frameDiff = frameNr-lastKey.f;

	frameDiff = Math.floor(frameDiff/frameSkip);

	if (!lastKey.animation){
		return lastKey.v;
	}else{

		var len = lastKey.v.length;

		if (lastKey.loop){
			
			if (!lastKey.refraction && !lastKey.reverse){
				return lastKey.v[frameDiff % len];
			}
			/*else if (!lastKey.refraction && lastKey.reverse){
				var fmod = frameNr % (len*2);
				return fmod < len ? lastKey.v[fmod] : (len-1)-(fmod-len);
			}*/
			else if (lastKey.refraction && !lastKey.reverse){
				return lastKey.v[Math.min(len-1,(frameDiff % (len+lastKey.refraction)))];
			}/*else if (lastKey.refraction && lastKey.reverse){

			}*/

		}else{
			return lastKey.v[Math.min(len-1,frameDiff)];			
		}
	}

}
G.GroupColliderLineLine = function(group1,group2,callback,context) {

	G.Image.call(this,0,0,null);

	this.group1 = group1;
	this.group2 = group2;
	this.callback = callback;
	this.context = context || null;

	this.collPoint = new Phaser.Point(0,0);

};

G.GroupColliderLineLine.prototype = Object.create(G.Image.prototype);

G.GroupColliderLineLine.prototype.update = function() {

	var len1 = this.group1.length;
	var len2 = this.group2.length;

	for (var i = 0; i < len1; i++) {
		var e1 = this.group1.children[i];
		for (var j = 0; j < len2; j++) {
			var e2 = this.group2.children[j];
			if (e1 === e2) continue;

			if (e1.collLine.intersects(e2.collLine, true, this.collPoint)) {
				this.callback.call(this.context,e1,e2,this.collPoint,this.group1,this.group2);
			} 

		}
	}

};


G.GroupColliderLineCircle = function(group1,group2,callback,context) {

	G.Image.call(this,0,0,null);

	this.group1 = group1;
	this.group2 = group2;
	this.callback = callback;
	this.context = context || null;

	this.collPoint = new Phaser.Point(0,0);

};

G.GroupColliderLineCircle.prototype = Object.create(G.Image.prototype);

G.GroupColliderLineCircle.prototype.update = function() {

	var len1 = this.group1.length;
	var len2 = this.group2.length;

	for (var i = this.group1.length; i--;) {
		var e1 = this.group1.children[i];
		for (var j = this.group2.length; j--;) {
			var e2 = this.group2.children[j];
			if (e1 === e2) continue;

			if (G.lineCircleColl(e1.collLine,e2.collCircle,this.collPoint)){
				this.callback.call(this.context,e1,e2,this.collPoint,this.group1,this.group2);
			} 

		}
	}

};
//OVERWRITES


//set alive to false
Phaser.Group.prototype.destroy = function (destroyChildren, soft) {

    if (this.game === null || this.ignoreDestroy) { return; }

    if (destroyChildren === undefined) { destroyChildren = true; }
    if (soft === undefined) { soft = false; }

    this.onDestroy.dispatch(this, destroyChildren, soft);

    this.removeAll(destroyChildren);

    this.cursor = null;
    this.filters = null;
    this.alive = false;
    this.pendingDestroy = false;

    if (!soft)
    {
        if (this.parent)
        {
            this.parent.removeChild(this);
        }

        this.game = null;
        this.exists = false;
    }

};


Phaser.exportChildren = function(obj){

    var result = [];

    for (var i = 0; i < obj.children.length; i++){
        var child = obj.children[i];
        if (child.exportToString){
            result.push(child.exportToString())
        }
    }

    return result;

};


Phaser.Group.prototype.exportToString = function(){

    var exportObj = {
        type: 'GROUP',
        x: this.x,
        y: this.y,
        scale: [this.scale.x,this.scale.y],
        angle: this.angle,
        children: Phaser.exportChildren(this)
    }

    return exportObj

};

Phaser.Image.prototype.exportToString = function(){

    exportObj = {
        type: 'IMG',
        x: this.x,
        y: this.y,
        frame: this.frameName,
        anchor: [this.anchor.x,this.anchor.y],
        scale: [this.scale.x,this.scale.y],
        angle: this.angle,
        children: Phaser.exportChildren(this)
    }

    return exportObj

};
G.Modify = function() {

	//in case that G.Modify was invoked without new
	if (this === G){
		return new G.Modify();
	}

	Phaser.Group.call(this,game);

	G.Modify.instance = this;

	this.onLevelObjChange = new Phaser.Signal();
	this.onCurrentObjChange = new Phaser.Signal();
	this.onObjDestroy = new Phaser.Signal();
	this.onCurrentObjPropModified = new Phaser.Signal();

	game.state.onStateChange.addOnce(this.turnOff,this);

	this.inputBlocker = new G.ModifyInputBlocked();
	this.add(this.inputBlocker);

	game.stage.disableVisibilityChange = true;
	game.paused = false;

	obj = game.state.getCurrentState();

	if (obj === game.state.getCurrentState()) {
		game.state.getCurrentState().children = game.world.children;
	}

	this.objectName = 'WORLD'; 

	this.currentLevel = game.world; 
	this.currentObject = null;


	this.gfx = game.add.graphics();
	this.gfx.fixedToCamera = true;
	this.add(this.gfx);
	this.obj = obj;

	//this.propGroup = this.add(new G.ModifyPropGroup(this));
	
	/*
	this.buttonGroup = new G.ModifyButtonGroup();
	this.add(this.buttonGroup);
	*/

	this.leftBar = document.createElement('div');
	this.leftBar.style.position = 'fixed';
	this.leftBar.style.top= '0';
	this.leftBar.style.left = '0';
	this.leftBar.style.pointerEvents = 'none';
	document.body.appendChild(this.leftBar);

	this.childList = new G.ModifyDOMChildList(this);
	this.leftBar.appendChild(this.childList.mainDiv);

	this.propList = new G.ModifyDOMPropList(this);
	this.leftBar.appendChild(this.propList.mainDiv);


	this.bottomBar = document.createElement('div');
	this.bottomBar.style.position = 'fixed';
	this.bottomBar.style.bottom = '0';
	this.bottomBar.style.left = '0';
	this.bottomBar.style.width = '100%';
	document.body.appendChild(this.bottomBar);

	this.objectFactory = new G.ModifyObjectFactory(this);
	this.objectFactory.onObjectAdded.add(function(obj){
		this.changeCurrentObject(obj);
		this.refreshLevel();
	},this);
	this.bottomBar.appendChild(this.objectFactory.mainDiv);


	this.buttonGroup = new G.ModifyDOMButtonGroup(this);


	//this.bottomBar = this.add(new G.ModifyBottomBar());

	this.frameSelector = new G.ModifyDOMFrameSelector();
	this.frameSelector.onFrameClicked.add(this.changeFrame,this);

	this.addKeyboardControlls();

	this.animationEditor = new G.ModifyAnimationEditor(this);
	this.add(this.animationEditor);

	this.removeCash = {};

	this.codeGenerator = new G.ModifyCodeGenerator(this);

	if (!game.state.states.MODIFYEMPTYSTATE){
		game.state.add('MODIFYEMPTYSTATE',{
			create: function(){
				new G.Modify();
			}
		});
	};

	this.domLayer = new G.ModifyDOMLayer(this);

	game.input.onDown.add(this.processClick,this);

	this.changeLevelObject(game.world);
	
};

G.Modify.prototype = Object.create(Phaser.Group.prototype);

G.Modify.prototype.removeCashObjToString = function(levelObjTxt) {

	if (!this.removeCash[levelObjTxt]) return '';
	
	var str = '\tREMOVED:'
	for (var i = 0; i < this.removeCash[levelObjTxt].length; i++) {
		str += '\t\t'+this.removeCash[levelObjTxt][i]+'\n'
	}
	return str;

};

G.Modify.prototype.removeObject = function() {

	console.log('removeObject');

	var obj = this.getCurrentObject();
	if (!obj) return;
	obj.destroy();
	this.currentObject = null;
	this.refreshLevel();

};

G.Modify.prototype.refreshLevel = function() {

	this.currentLevel = this.currentLevel;
	this.onLevelObjChange.dispatch(this.currentLevel);

};

G.Modify.prototype.update = function() {

	this.updateKeyboard();
	this.redrawGfx();

	for (var i = 0; i < this.children.length; i++){
		this.children[i].update();
	}

};

G.Modify.prototype.getChildrenData = function(obj){

	obj = obj || this.currentLevel;

	var childrenData = [];

	for (var i = 0; i < obj.children.length; i++){

		var found = false;
		var child = obj.children[i];

		// in case G.Modify
		if (child === this) {
			continue;
		}

		var hasChildren = (obj.children[i].children && obj.children[i].children.length > 0) || obj.children[i].constructor === Phaser.Group;
		var isTextObj = obj.children[i].constructor == G.OneLineText || obj.children[i].constructor == G.MultiLineText;

		var childData = {
			label: this.getChildLabel(child),
			openable: !isTextObj,
			hasChildren: hasChildren,
			obj: child,
			current: child == this.currentObject
		};

		childrenData.push(childData);

	}

	return childrenData;

};

G.Modify.prototype.getChildLabel = function(child){

	var parent = child.parent;

	if (parent == game.stage) child.___LABEL = 'WORLD';

	if (child.___LABEL)	{
		return child.___LABEL
	}else{

		//in case of lvlobj being world change to state (as it is more probable to have world children as prop)
		var propObj = parent == game.world ? game.state.getCurrentState() : parent;

		//child doesnt have a label, so lets try to find prop that hold it
		for (var prop in propObj) {
			
			//wtf why cursor?
			if (prop == 'children' || prop == 'cursor') {
				continue;
			}
			
			if (child === propObj[prop]) {
				//found good name so lets make label out of it
				child.___LABEL = prop;
				return child.___LABEL;
			}

			if (Array.isArray(propObj[prop]) && prop !== 'children') {
				var index = propObj[prop].indexOf(child);
				if (index > 0){
					return 'prop['+index+']';
				};
			}

		}

	}

	//if everything fails just get children[i]
	return 'children['+parent.children.indexOf(child)+']';

};

G.Modify.prototype.getCurrentObject = function() {
	return this.currentObject;
};

G.Modify.prototype.changeFrame = function(newFrame) {

	console.log(newFrame);

	var obj = this.getCurrentObject();

	this.saveInitPropValue('frameName',newFrame);

	if (obj.loadTexture) {
		G.changeTexture(obj,newFrame);
	}

	this.onCurrentObjPropModified.dispatch();

};

G.Modify.prototype.getCurrentLevelObject = function() {

	return this.currentLevel;


};

G.Modify.prototype.redrawGfx = function() {

	return; 

	this.gfx.clear();


	//whole group

	var obj = this.getCurrentLevelObject();

	if (obj !== game.state.getCurrentState()) {

		var bounds = obj.getLocalBounds();
		this.gfx.lineStyle(3, 0xff0000, 0.2);
		this.gfx.drawRect(
			obj.worldPosition.x+bounds.x,
			obj.worldPosition.y+bounds.y,
			bounds.width,
			bounds.height);

		this.gfx.beginFill(0x000000,0.5);
		this.gfx.drawRect(obj.worldPosition.x-10,obj.worldPosition.y-10,20,20);
		
	}

	
	this.gfx.beginFill(0x000000,0);


	//childrens

	this.childrenPropNames.forEach(function(key,index) {

		var activeObj = index == this.currentChildIndex;
		this.gfx.lineStyle(activeObj ? 3 : 1, 0x0000ff, activeObj ? 1 : 0.2);
		var obj = this.getCurrentLevelObject().children[index];
		if (!obj) return;
		var bounds = obj.getBounds();
		var localBounds = obj.getLocalBounds();
		this.gfx.drawRect(
			obj.worldPosition.x+localBounds.x*obj.scale.x,
			obj.worldPosition.y+localBounds.y*obj.scale.y,
			bounds.width*obj.scale.x,
			bounds.height*obj.scale.y
		);

		if (activeObj && obj.maxUserWidth && !obj.maxUserHeight) {

			this.gfx.lineStyle(2,0x00ff00,0.5);
			this.gfx.drawRect(
				obj.worldPosition.x - (obj.anchor.x*obj.maxUserWidth),
				obj.worldPosition.y - (obj.anchor.y*obj.height),
				obj.maxUserWidth,
				obj.height
			);
		}else if (activeObj && obj.maxUserWidth && obj.maxUserHeight) {

			this.gfx.lineStyle(2,0x00ff00,0.5);
			this.gfx.drawRect(
				obj.worldPosition.x - (obj.anchor.x*obj.maxUserWidth),
				obj.worldPosition.y - (obj.anchor.y*obj.maxUserHeight),
				obj.maxUserWidth,
				obj.maxUserHeight
			);
		}

	},this);

};


G.Modify.prototype.addKeyboardControlls = function() {

	this.keys = game.input.keyboard.addKeys({
		'Q':Phaser.Keyboard.Q,
		'W':Phaser.Keyboard.W,
		'E':Phaser.Keyboard.E,
		'UP':Phaser.Keyboard.UP,
		'ONE':Phaser.Keyboard.ONE,
		'TWO':Phaser.Keyboard.TWO,
		'DOWN':Phaser.Keyboard.DOWN,
		'RIGHT':Phaser.Keyboard.RIGHT,
		'LEFT':Phaser.Keyboard.LEFT,
		'ALT':Phaser.Keyboard.ALT,
		'Z':Phaser.Keyboard.Z,
		'X':Phaser.Keyboard.X,
		'C':Phaser.Keyboard.C,
		'U':Phaser.Keyboard.U,
		'PLUS': 107,
		'MINUS': 109,
		'ESC': Phaser.Keyboard.ESC,
		'NUM8': 104,
		'NUM5': 101,
		'NUM4': 100,
		'NUM6': 102,
		'NUM2': 98,
		'NUM7': 103,
		'NUM9': 105,
		'NUMSTAR': 106,
		'SPACE' : Phaser.Keyboard.SPACEBAR,
		'V': Phaser.Keyboard.V,
		'L': Phaser.Keyboard.L,
		'I': Phaser.Keyboard.I,
		'P': Phaser.Keyboard.P,
		'O': Phaser.Keyboard.O,
		'M': Phaser.Keyboard.M,
		'DEL': Phaser.Keyboard.DELETE,
		'sqBracketOpen': 219,
		'sqBracketClose': 221,
		'SHIFT': Phaser.Keyboard.SHIFT

	});


	this.keys.sqBracketOpen.onDown.add(function(){
		if (this.keys.SHIFT.isDown) {
			this.objToBottom();
		}else {
			this.objMoveDown();
		}
	},this);

	this.keys.sqBracketClose.onDown.add(function(){
		if (this.keys.SHIFT.isDown) {
			this.objToTop();
		}else {
			this.objMoveUp();
		}
	},this);



	this.keys.frameCounter = 0; 

	this.keys.L.onDown.add(function(){
		var lvlObj = this.getCurrentLevelObject();
		var obj = this.getCurrentObject();

		if (!obj) return;

		this.domLayer.openInputDiv(
		(obj.___LABEL || 'obj')+' | label',
		obj.___LABEL || '',
		function(value){
			if (lvlObj[value] === undefined) {

				if (obj.___LABEL){
					delete lvlObj[obj.___LABEL];
				}

				lvlObj[value] = obj;
				obj.___LABEL = value;
				this.refreshLevel();
			}
		},
		this,'string');

	},this);


	//change children +1
	this.keys.Q.onDown.add(function() {
		this.changeCurrentChildrenIndex(-1);
	},this);

	//change children -1
	this.keys.W.onDown.add(function() {
		this.changeCurrentChildrenIndex(1);
	},this);

	//enter child
	this.keys.TWO.onDown.add(function() {
		if (!this.currentObject) return;
		this.changeLevelObject(this.currentObject);
	},this);

	//exit child
	this.keys.ONE.onDown.add(this.currentLevelGoUp,this);

	//kill modify
	this.keys.ESC.onDown.add(function(){
		if (this.escPressed === undefined){
			this.escPressed = 0;
		}

		this.escPressed++;
		game.time.events.add(2000,function(){
			this.escPressed = 0;
		},this)

		if (this.escPressed < 5) return;

		this.turnOff();

	},this);




	this.keys.E.onDown.add(function() {
		this.exportChanges();
	},this);

	//restar to initial position
	this.keys.NUM5.onDown.add(function() {

		var obj = this.getCurrentObject();

		if (!obj) return;

		obj.scale.setTo(1);
		obj.angle = 0;
		obj.alpha = 1;
		obj.visible = true;
		obj.anchor.setTo(0.5);

	},this);

	

	

	//change alpha settings
	this.keys.V.onDown.add(function(){
		this.alpha = this.alpha == 1 ? 0.1 : 1;
	},this);

	//mark obj as constructor
	this.keys.O.onDown.add(function(){
		var obj = this.getCurrentObject();
		if (obj instanceof Phaser.Group) {
			obj.___CONSTRUCTOR = true;
		}
	},this);

	//generate code
	this.keys.P.onDown.add(function(){
		var obj = this.getCurrentObject();
		var str = this.codeGenerator.start(obj);
	},this);


	this.keys.C.onDown.add(function(){
		var pointer = game.input.activePointer;
		var newObj = this.addImage();
		this.setNewCurrentChildren(newObj);
		this.moveCurrentObjectToWorldPos(pointer.x,pointer.y);

	},this);

	//go to modify empty state
	this.keys.I.onDown.add(function(){
		if (this.pressCounterI === undefined) {
			this.pressCounterI = 0;
		}

		this.pressCounterI++;

		if (this.pressCounterI == 3){
			game.state.start('MODIFYEMPTYSTATE');
		}

		game.time.events.add(1000,function(){
			this.pressCounterI = 0;
		},this);
	},this);

	this.keys.DEL.onDown.add(this.removeObject,this);

	this.keys.NUMSTAR.onDown.add(this.frameSelector.toggle,this.frameSelector);

	//hide child list
	this.keys.U.onDown.add(function(){
		this.childList.toggleList();
	},this);

};

G.Modify.prototype.turnOff = function(force) {

	for (key in this.keys) {
		if (this.keys[key].onDown) {
			this.keys[key].onDown.removeAll();
		}
	}	


	this.gfx.destroy();
	this.buttonGroup.destroy();
	this.frameSelector.destroy();

	//this.levelTxt.destroy();
	//this.propGroup.destroy();
	//this.groupTxt.destroy();

	this.leftBar.remove();
	this.destroy();

};


G.Modify.prototype.modifyCurrentObjProp = function(prop,value){

	var obj = this.getCurrentObject();
	this.saveInitPropValue(prop,value);
	G.Utils.setObjProp(obj,prop,value);
	this.onCurrentObjPropModified.dispatch();

};

G.Modify.prototype.saveInitPropValue = function(prop,newVal){

	var obj = this.getCurrentObject();

	if (Array.isArray(prop)) prop = prop.join('.');

	var val = G.Utils.getObjProp(obj,prop);

	//exit if nothing changes
	if (val === newVal) return;

	if (!obj.___initState) obj.___initState = {};

	//if there was init value before, dont overwrite it
	if (typeof obj.___initState[prop] !== 'undefined'){
		return;
	}

	obj.___initState[prop] = G.Utils.getObjProp(obj,prop);

};

G.Modify.prototype.updateKeyboard = function() {

	var obj = this.getCurrentObject();

	if(!obj) return;

	this.keys.frameCounter++;


	
	var val = 1;
	var proc = true;
	if (this.keys.Z.isDown){
		if (this.keys.frameCounter % 5 != 0) {
			proc = false;
		}
	}


	//position
	
	if (this.keys.X.isDown) {
		val = 5;
	}
	if (this.keys.C.isDown) {
		val = 20;
	}

	if (proc && this.keys.UP.isDown) {
		this.modifyCurrentObjProp('y',obj.y-val);
		//obj.position.y-=val;
	}
	if (proc && this.keys.DOWN.isDown) {
		this.modifyCurrentObjProp('y',obj.y+val);
		//obj.position.y+= val;
	}
	if (proc && this.keys.LEFT.isDown) {
		this.modifyCurrentObjProp('x',obj.x-val);
		//obj.position.x-=val;
	}
	if (proc && this.keys.RIGHT.isDown) {
		this.modifyCurrentObjProp('x',obj.x+val);
		//obj.position.x+= val;
	}

	

	val = 0.025;

	if (this.keys.X.isDown) {
		val = 0.05;
	}
	if (this.keys.C.isDown) {
		val = 0.1;
	}

	if (proc && this.keys.NUM8.isDown) {
		this.modifyCurrentObjProp('scale.y',obj.scale.y+val);
		//obj.scale.y+=val;
	}
	if (proc && this.keys.NUM2.isDown) {
		this.modifyCurrentObjProp('scale.y',obj.scale.y-val);
		obj.scale.y-= val;
	}
	if (proc && this.keys.NUM4.isDown) {
		this.modifyCurrentObjProp('scale.x',obj.scale.x-val);
		//obj.scale.x-=val;
	}
	if (proc && this.keys.NUM6.isDown) {
		this.modifyCurrentObjProp('scale.x',obj.scale.x+val);
		//obj.scale.x+= val;
	}

	if (proc && this.keys.PLUS.isDown) {
		this.modifyCurrentObjProp('scale.x',obj.scale.x+val);
		this.modifyCurrentObjProp('scale.y',obj.scale.y+val);
		//obj.scale.x += val;
		//obj.scale.y += val;
	}
	if (proc && this.keys.MINUS.isDown) {
		this.modifyCurrentObjProp('scale.x',obj.scale.x-val);
		this.modifyCurrentObjProp('scale.y',obj.scale.y-val);
		//obj.scale.x -= val;
		//obj.scale.y -= val;
	}

	//obj.scale.x = parseFloat(obj.scale.x.toFixed(3));
	//obj.scale.y = parseFloat(obj.scale.y.toFixed(3));
	


	//angle


	val = 1;

	if (this.keys.X.isDown) {
		val = 2;
	}
	if (this.keys.C.isDown) {
		val = 5;
	}

	if (proc && this.keys.NUM7.isDown) {
		this.modifyCurrentObjProp('angle',obj.angle-val);
		//obj.angle+=val;
	}
	if (proc && this.keys.NUM9.isDown) {
		this.modifyCurrentObjProp('angle',obj.angle+val);
		//obj.angle-= val;
	}


	if (this.keys.SPACE.isDown) {

		this.modifyCurrentObjProp('x',Math.floor(obj.x/5)*5);
		this.modifyCurrentObjProp('y',Math.floor(obj.y/5)*5);

		this.modifyCurrentObjProp('scale.x',Math.floor(obj.scale.x/0.025)*0.025);
		this.modifyCurrentObjProp('scale.y',Math.floor(obj.scale.y/0.025)*0.025);

		this.modifyCurrentObjProp('angle',Math.floor(obj.angle));

	}


};

G.Modify.prototype.currentLevelGoUp = function(){
	
	//that means that we are on the top
	if (this.currentLevel.parent == game.stage) return;
	this.changeLevelObject(this.currentLevel.parent);

};

//new stuff
G.Modify.prototype.changeLevelObject = function(obj){

	this.currentLevel = obj;
	//this.childrenPropNames = this.getChildrenPropNames();
	this.onLevelObjChange.dispatch(obj);
	this.changeCurrentObject(this.currentLevel.children[0]);

};

//new stuff
G.Modify.prototype.changeCurrentObject = function(obj){

	if (!obj) return;

	this.currentObject = obj;
	this.onCurrentObjChange.dispatch();

};






G.Modify.prototype.changeCurrentChildrenIndex = function(change) {

	if (!this.currentObject) return;

	var index = this.currentLevel.children.indexOf(this.currentObject)+change;

	if (index < 0) {
		index = this.currentLevel.children.length-1;
	}
	if (index >= this.currentLevel.children.length) {
		index = 0;
	}

	//check if it is not modify
	if (this.currentLevel.children[index] == this){
		index = change > 0 ? 0 : index+change;
	}

	//check if it even has a child
	if (this.currentLevel.children[index]){
		this.changeCurrentObject(this.currentLevel.children[index]);
	}

};




G.Modify.prototype.processClick = function(){

	var pointer = game.input.activePointer;
	if (this.keys.M.isDown) {
		this.moveCurrentObjectToWorldPos(pointer.x,pointer.y);
	}

};


G.Modify.prototype.moveCurrentObjectToWorldPos = function(x,y){

		console.log(x,y);

		var obj = this.getCurrentObject(); 
		if (!obj) return;

		obj.updateTransform();

		var offsetX = x - obj.worldPosition.x;
		var offsetY = y - obj.worldPosition.y;

		var offset = new Phaser.Point(offsetX,offsetY);
		var pointer = new Phaser.Point(x,y);
		offset.normalize();

		var dist = obj.worldPosition.distance(pointer);

		while (true){

			var prev = dist;

			obj.x += offset.x;
			obj.y += offset.y;
			obj.updateTransform();

			var dist = obj.worldPosition.distance(pointer);

			if (dist > prev) break;

		}

		obj.x = Math.floor(obj.x);
		obj.y = Math.floor(obj.y);

};

G.Modify.prototype.moveCurrentObjectToWorldPos = function(targetX,targetY){

	if (!this.currentObject) return;

	var toLocal = this.currentLevel.toLocal({x:targetX,y:targetY});
	this.modifyCurrentObjProp('x',Math.floor(toLocal.x));
	this.modifyCurrentObjProp('y',Math.floor(toLocal.y));

};

G.Modify.prototype.worldPosToLocal

G.Modify.prototype.addMouseWheel = function(){

	function mouseWheel(event) { 
			
		var lvlObj = this.getCurrentLevelObject();
		if (lvlObj && lvlObj !== game.world) {
			lvlObj.y += game.input.mouse.wheelDelta * 150;
		}
			
	}

	game.input.mouse.mouseWheelCallback = mouseWheel.bind(this);

};


G.Modify.prototype.exportLvlAsString = function(){

	var exportObj = [];

	var lvl = this.getCurrentLevelObject();

	for (var i = 0; i < lvl.children.length; i++) {

		var child = lvl.children[i];

		if (!(child instanceof Phaser.Image)) continue;

		var frameName = null;
		if (typeof child.frameName === 'string') {
			if (child.frameName.indexOf('/') == -1) {
				frameName = child.frameName;
			}else {
				frameName = child.key;
			}
		}


		var childObj = {
			x: child.x,
			y: child.y,
			frame: frameName,
			anchor: [child.anchor.x,child.anchor.y],
			scale: [child.scale.x,child.scale.y],
			angle: child.angle
		};

		if (child.___LABEL) {
			childObj.label = child.___LABEL;
		}

		if (child.___DATA) {
			childObj.data = child.___DATA;
		}

		exportObj.push(childObj);

	};

	console.log(JSON.stringify(exportObj));

	G.Utils.copyToClipboard(JSON.stringify(exportObj));

};

G.Modify.prototype.objToTop = function(){

	if (this.currentObject){
		this.currentLevel.bringToTop(this.currentObject);
	}
	this.refreshLevel();

}; 

G.Modify.prototype.objMoveUp = function(){

	if (this.currentObject){
		this.currentLevel.moveUp(this.currentObject);
	}
	this.refreshLevel();

};

G.Modify.prototype.objMoveDown = function(){

	if (this.currentObject){
		this.currentLevel.moveDown(this.currentObject);
	}
	this.refreshLevel();

};

G.Modify.prototype.objToBottom = function(){

	if (this.currentObject){
		this.currentLevel.sendToBack(this.currentObject);
	}
	this.refreshLevel();

};



//TO DO

G.Modify.prototype.childPropChange = function(currentLevel) {

	var orgLevel = this.currentLevel;
	var orgIndex = this.currentChildIndex;

	this.currentLevel = currentLevel || [];

	var currentLevelTxt = this.currentLevel.join('/') || (this.currentLevel[0] || game.state.current);

	var removeStr = this.removeCashObjToString(currentLevelTxt);

	var exportStr = '';

	var childrenPropNames = this.getChildrenPropNames();

	for (var i = 0; i < childrenPropNames.length; i++) {
		this.currentChildIndex = i;
		var obj = this.getCurrentObject();

		if (obj === this) continue;

		var currentChildPropTxt = childrenPropNames[i].toString();

		var fresh = obj.___NEWOBJECT;
		var isText = obj.constructor === G.OneLineText || obj.constructor === G.MultiLineText;

		if (fresh) {
			exportStr += 'NEW OBJECT \n';
			/*if (obj.___IMAGE) {
				exportStr += this.generateImageCode(currentChildPropTxt,obj);
			}*/
		}

		if (obj.___initState) {

			exportStr += '\t'+childrenPropNames[i]+'\n';

			var keys = Object.keys(obj.___initState);

			keys.forEach(function(key){
				exportStr += '\t'+key+':  '+G.Utils.getObjProp(obj,key)+'\n';
			},this);

			obj.___initState = undefined;

		}

		if (!isText && (fresh || obj.children && obj.children.length > 0)) {
			this.childPropChange(this.currentLevel.concat(childrenPropNames[i]));
		}


	};

	if (exportStr.length > 0 || removeStr.length > 0) {

		if (removeStr.length > 0) removeStr+'\n'
		if (exportStr.length > 0) exportStr+'\n'
		this.export += currentLevelTxt+'\n'+removeStr+exportStr;

	}

	this.currentChildIndex = orgIndex;
	this.currentLevel = orgLevel;

};

G.Modify.prototype.exportChanges = function() {

	this.export = '';;
	this.childPropChange();

	if (this.export) {

		this.export = this.objectName+'\n'+this.export;
		G.Utils.copyToClipboard(this.export);
		console.log(this.export);
	}else{
		console.log('NO CHANGES TO EXPORT');
	}

};
G.ModifyButtonGroup = function() {

    Phaser.Group.call(this, game);

    this.modify = G.Modify.instance;

    this.fixedToCamera = true;

    this.gfx = this.add(game.add.graphics());

    this.transformButtons = this.add(game.add.group());
    this.changeObjButtons = this.add(game.add.group());

    this.mode = 0;

    this.tabKey = game.input.keyboard.addKey(Phaser.Keyboard.TAB);
    this.tabKey.onDown.add(function() {
        this.gfx.clear();
        this.mode = (this.mode + 1) % 2;
        this.transformButtons.visible = this.mode == 0;
        this.changeObjButtons.visible = this.mode == 1;
    }, this);

    this.keys = {
        ALT: game.input.keyboard.addKey(Phaser.Keyboard.ALT)
    }



    this.clickedButton = null;
    this.clickedPos = null;



    this.posButton = game.add.button(0, 0, null);
    this.posButton.onInputDown.add(function() {
        this.clickedButton = this.posButton;
        this.clickedPos = { x: game.input.activePointer.x, y: game.input.activePointer.y };
    }, this);
    this.posButton.anchor.setTo(0.5, 0.5);
    this.posButton.tint = 0xff0000;
    this.transformButtons.add(this.posButton);

    this.scaleButton = game.add.button(0, 0, null);
    this.scaleButton.onInputDown.add(function() {
        this.clickedButton = this.scaleButton;
        this.clickedPos = { x: game.input.activePointer.x, y: game.input.activePointer.y };
    }, this);
    this.scaleButton.anchor.setTo(0.5, 0.5);
    this.scaleButton.tint = 0x00ff00;
    this.transformButtons.add(this.scaleButton);


    this.rotateButton = game.add.button(0, 0, null);
    this.rotateButton.onInputDown.add(function() {
        this.clickedButton = this.rotateButton;
        this.clickedPos = { x: game.input.activePointer.x, y: game.input.activePointer.y };
    }, this);
    this.rotateButton.anchor.setTo(0.5, 0.5);
    this.rotateButton.tint = 0x00ff00;
    this.transformButtons.add(this.rotateButton);

    this.refreshChangeObjButtons();

    this.modify.onLevelObjChange.add(this.refreshChangeObjButtons, this);
    this.modify.onObjDestroy.add(this.refreshChangeObjButtons, this);

};

G.ModifyButtonGroup.prototype = Object.create(Phaser.Group.prototype);

G.ModifyButtonGroup.prototype.update = function() {

    if (this.mode == 0) {
        this.updateTransformButtons();
   		this.transformButtons.ignoreChildInput = false;
        this.changeObjButtons.ignoreChildInput = true;
    } else {
    	this.transformButtons.ignoreChildInput = true;
        this.changeObjButtons.ignoreChildInput = false;
        this.updateChangeObjButtons();
    };

};

G.ModifyButtonGroup.prototype.updateTransformButtons = function() {

    var obj = this.modify.getCurrentObject();
    if (!obj) {
        this.posButton.position.setTo(-9999, -9999);
        this.scaleButton.position.setTo(-9999, -9999);
        this.rotateButton.position.setTo(-9999, -9999);
        return;
    };
    var bounds = obj.getBounds();
    var localBounds = obj.getLocalBounds();
    var pointer = game.input.activePointer

    this.posButton.x = obj.worldPosition.x;
    this.posButton.y = obj.worldPosition.y;

    this.scaleButton.x = obj.worldPosition.x + localBounds.x * obj.scale.x + bounds.width * obj.scale.x + 20,
        this.scaleButton.y = obj.worldPosition.y + localBounds.y * obj.scale.y + bounds.height * obj.scale.y + 20;

    this.rotateButton.x = obj.worldPosition.x + localBounds.x * obj.scale.x - 20;
    this.rotateButton.y = obj.worldPosition.y + localBounds.y * obj.scale.y - 20;



    this.gfx.clear();

    this.gfx.lineStyle(1, 0x000000, 1);
    this.gfx.beginFill(0xff0000, 1);
    this.gfx.drawCircle(this.posButton.worldPosition.x, this.posButton.worldPosition.y, 10);
    this.gfx.endFill();

    this.gfx.beginFill(0x00ff00, 1);
    this.gfx.drawCircle(this.scaleButton.worldPosition.x, this.scaleButton.worldPosition.y, 10);
    this.gfx.endFill();

    this.gfx.beginFill(0x0000ff, 1);
    this.gfx.drawCircle(this.rotateButton.worldPosition.x, this.rotateButton.worldPosition.y, 10);
    this.gfx.endFill();


    if (!this.clickedButton) return;

    if (pointer.isDown) {
        var offsetX = pointer.x - this.clickedPos.x;
        var offsetY = pointer.y - this.clickedPos.y;

        if (this.clickedButton === this.posButton) {
            this.modify.modifyCurrentObjProp('x', obj.x + offsetX);
            this.modify.modifyCurrentObjProp('y', obj.y + offsetY);
        }

        if (this.clickedButton === this.scaleButton) {
            this.modify.modifyCurrentObjProp('width', obj.width + offsetX);
            this.modify.modifyCurrentObjProp('height', obj.height + offsetY);
            if (this.keys.ALT.isDown) {
                //obj.scale.y = obj.scale.x;
                this.modify.modifyCurrentObjProp('scale.y', obj.scale.x);
            }
        }

        if (this.clickedButton === this.rotateButton) {
            this.modify.modifyCurrentObjProp('angle', obj.angle + offsetX * 0.25);
            //obj.angle += offsetX*0.25;

        }

        this.clickedPos = { x: game.input.activePointer.x, y: game.input.activePointer.y };
    } else {
        this.modify.modifyCurrentObjProp('x', Math.floor(obj.x / 5) * 5);
        this.modify.modifyCurrentObjProp('y', Math.floor(obj.y / 5) * 5);
        this.modify.modifyCurrentObjProp('scale.x', Math.floor(obj.scale.x / 0.025) * 0.025);
        this.modify.modifyCurrentObjProp('scale.y', Math.floor(obj.scale.y / 0.025) * 0.025);
        this.modify.modifyCurrentObjProp('angle', Math.floor(obj.angle));
        this.clickedButton = null;
    }



};

G.ModifyButtonGroup.prototype.updateChangeObjButtons = function() {

    this.gfx.clear();
    this.gfx.beginFill(0x00ff00, 1);
    this.gfx.lineStyle(3, 0xff0000, 1)

    for (var i = 0; i < this.changeObjButtons.length; i++) {
        var child = this.changeObjButtons.children[i];
        this.gfx.drawCircle(child.worldPosition.x, child.worldPosition.y, 10);
    }

};

G.ModifyButtonGroup.prototype.refreshChangeObjButtons = function() {

    this.changeObjButtons.removeAll(true);

    var currentLevel = this.modify.getCurrentLevelObject();

    for (var i = 0; i < currentLevel.children.length; i++) {

        if (currentLevel.children[i] == this.modify) continue;

        var child = currentLevel.children[i];
        var btn = game.make.button(0, 0, null);
        this.changeObjButtons.add(btn);
        btn.attachement = child;
        btn.modify = this.modify;
        btn.position = child.worldPosition;
        btn.hitArea = new Phaser.Circle(0, 0, 10);
        btn.onInputDown.add(function() {
            this.modify.setNewCurrentChildren(this.attachement);
        }, btn);

    }

};

G.ModifyCodeGenerator = function(modify){

	this.modify = modify;

};


G.ModifyCodeGenerator.prototype.start = function(obj){

	this.constStr = '';
	var exeStr = this.generateCode(obj);

	var endStr = this.constStr+'\n\n'+exeStr;

	G.Utils.copyToClipboard(endStr);
	console.log(endStr);

};


G.ModifyCodeGenerator.prototype.generateCode = function(obj,prefix){

	if (G.OneLineText) {
		if (obj instanceof G.OneLineText) {
			return this.generateCodeOneLineText(obj,prefix);
		}
	}

	if (G.MultiLineText){
		if (obj instanceof G.MultiLineText) {
			return this.generateCodeMultiLineText(obj,prefix);
		}
	}

	if (G.Button){
		if (obj instanceof G.Button){
			return this.generateCodeButton(obj,prefix);
		}
	}

	if ((obj instanceof Phaser.Group) && !(obj instanceof Phaser.BitmapText)){
		if (obj.___CONSTRUCTOR) {
			return this.generateConstructorCode(obj,prefix);
		}else {
			return this.generateGroupCode(obj,prefix);
		}
	}

	
	return this.generateCodeImage(obj,prefix);
		
};

G.ModifyCodeGenerator.prototype.generateConstructorCode = function(obj,prefix,inside){

	var name = this.getObjName(obj);

	var capName = G.capitalize(name);

	var constStr = '';

	constStr += 'G.'+capName+' = function(x,y){\n';
	constStr +=	'\tPhaser.Group.call(this,game);\n';
	constStr += '\tthis.position.setTo(x,y);\n';
	constStr += this.generateCodeUniProp(obj,'this');
	constStr += '\n';

	for (var i = 0; i < obj.children.length; i++){
		constStr += '\t'+this.generateCode(obj.children[i],'this');
		constStr += '\n';
	}

	constStr += '};\n';
	constStr += 'G.'+capName+'.prototype = Object.create(Phaser.Group.prototype);\n\n';

	this.constStr += constStr;

	var exeStr = (prefix ? prefix+'.' : 'var ') +'%NAME% = new G.'+capName+'(^x^,^y^);\n';
	if (prefix) {
		exeStr += prefix+'.add('+prefix+'.%NAME%);\n';
	}
	exeStr = G.Utils.replaceAll(exeStr,'%NAME%',name);
	exeStr = this.injectObjPropToString(obj,exeStr);

	return exeStr;

};

G.ModifyCodeGenerator.prototype.generateGroupCode = function(obj,prefix) {

	var name = this.getObjName(obj);

	var str = (prefix ? prefix+'.' : 'var ') +'%NAME% = game.add.group();\n';
	str += (prefix ? prefix+'.' : '')+'%NAME%.position.setTo(^x^,^y^);\n';
	str += this.generateCodeUniProp(obj,prefix);

	if (prefix) {
		str += prefix+'.add('+prefix+'.%NAME%);\n';
	}

	for (var i = 0; i < obj.children.length; i++){
		var childStr = this.generateCode(obj.children[i],(prefix ? prefix+'.' : '')+name,true);
		str += G.Utils.replaceAll(childStr,'this','%NAME%');
	}

	str = G.Utils.replaceAll(str,'%NAME%',name);
	return this.injectObjPropToString(obj,str);
}

G.ModifyCodeGenerator.prototype.generateGroupConstructor = function(obj){



};

G.ModifyCodeGenerator.prototype.generateChildrensCode = function(obj){


};

G.ModifyCodeGenerator.prototype.generateCodeButton = function(obj,prefix){

	prefix = prefix || '';

	var str = '';
	str += (prefix ? prefix+'.' : 'var ') +"%NAME% = new G.Button(^x^,^y^,'^frameName^',function(){},this);\n"; 
	str += (prefix ? prefix+'.' : '')+'add('+(prefix ? prefix+'.' : 'var ')+'%NAME%);\n';
	str += this.generateCodeUniProp(obj,prefix);
	str = G.Utils.replaceAll(str,'%NAME%',this.getObjName(obj));
	return this.injectObjPropToString(obj,str);

};

G.ModifyCodeGenerator.prototype.generateCodeImage = function(obj,prefix){

	var str = '';
	str += (prefix ? prefix+'.' : 'var ') +"%NAME% = G.makeImage(^x^,^y^,'^frameName^',[^anchor.x^,^anchor.y^],"+prefix+");\n";
	str += this.generateCodeUniProp(obj,prefix);
	str = G.Utils.replaceAll(str,'%NAME%',this.getObjName(obj));
	return this.injectObjPropToString(obj,str);

};

G.ModifyCodeGenerator.prototype.generateCodeOneLineText = function(obj,prefix){

	var str = '';
	str += (prefix ? prefix+'.' : 'var ') + "%NAME% = new G.OneLineText(^x^,^y^,'^font^','^text^',^fontSize^,^maxUserWidth^,^anchor.x^,^anchor.y^);\n";
	str += (prefix ? prefix+'.' : '')+'add('+(prefix ? prefix+'.' : 'var ')+'%NAME%);\n';
	str += this.generateCodeUniProp(obj,prefix);
	str = G.Utils.replaceAll(str,'%NAME%',this.getObjName(obj));
	return this.injectObjPropToString(obj,str);

};

G.ModifyCodeGenerator.prototype.generateCodeMultiLineText = function(obj,prefix){

	var str = '';	
	str +=  (prefix ? prefix+'.' : 'var ') + "%NAME% = new G.MultiLineText(^x^,^y^,'^font^','^text^',^fontSize^,^maxUserWidth^,^maxUserHeight^,'^align^',^anchor.x^,^anchor.y^);\n";
	str += (prefix ? prefix+'.' : '')+'add('+(prefix ? prefix+'.' : 'var ')+'%NAME%);\n';
	str += this.generateCodeUniProp(obj,prefix);
	str = G.Utils.replaceAll(str,'%NAME%',this.getObjName(obj));
	return this.injectObjPropToString(obj,str);

};


G.ModifyCodeGenerator.prototype.getObjName = function(obj){

	if (obj.___LABEL){
		return obj.___LABEL;
	}else{
		var name = prompt('enter name');
		obj.___LABEL = name;
		return name;
	}

};

G.ModifyCodeGenerator.prototype.generateCodeUniProp = function(obj,prefix){

	var str = '';
	prefix = prefix ? prefix+'.' : '';

	if (obj.scale.x !== 1 || obj.scale.y !== 1){
		str += prefix+'%NAME%.scale.setTo(^scale.x^, ^scale.y^);\n';
	}

	if (obj.angle !== 0){
		str += prefix+'%NAME%.angle = ^angle^;\n';
	}

	if (obj.alpha !== 1){
		str += prefix+'%NAME%.alpha = ^alpha^;\n';
	}

	if (obj.fixedToCamera){
		str += prefix+'%NAME%.fixedToCamera = true;\n';
		str += prefix+'%NAME%.cameraOffset.setTo(^cameraOffset.x^,^cameraOffset.y^);\n';
	}

	return str;

};


G.ModifyCodeGenerator.prototype.injectObjPropToString = function(obj,str){

	while (true){

		var firstIndex = str.indexOf('^');
		var secondIndex = str.indexOf('^',firstIndex+1);

		if (firstIndex == -1){
			break;
		}

		var toReplace = str.slice(firstIndex,secondIndex+1);
		var propToGet = str.slice(firstIndex+1,secondIndex);

		str = str.replace(toReplace,G.Utils.getObjProp(obj,propToGet));


	};

	return str;

};
G.ModifyInputBlocked = function(){

	Phaser.Graphics.call(this,game,0,0);

	this.beginFill(0xff0000,0.0001);
	this.drawRect(0,0,5000,4000);
	this.inputEnabled=true;
	this.events.onInputDown.add(function(){});
	this.fixedToCamera = true;

};

G.ModifyInputBlocked.prototype = Object.create(Phaser.Graphics.prototype);
G.ModifyObjectFactory = function(modify){

	G.Utils.injectCSS(this.cssClasses.join('\n'));

	this.modify = modify;

	this.mainDiv = document.createElement('div');
	this.domUl = document.createElement('ul');
	this.domUl.className = 'modifyOFul';
	this.mainDiv.appendChild(this.domUl);

	this.addLiButtons([
		['+GROUP',this.addGroup],
		['+IMG',this.addImage],
		['+OneLineTXT',this.addOneLineText],
		['+MulitLineTXT',this.addMultiLineText],
		['+BTN',this.addButton],
		['-REMOVE',this.modify.removeObject],
		['EXPORT LVLOBJ STR',this.modify.exportLvlAsString]
	]);

	this.defaultNewObjectsNames = true;

	this.onObjectAdded = new Phaser.Signal();

};

G.ModifyObjectFactory.prototype.cssClasses = [
	'.modifyOFul {padding: 0px; margin: 0px;}',
	'.modifyOFli {display: inline; list-style-type: none;}'
];

G.ModifyObjectFactory.prototype.addLiButtons = function(list){

	list.forEach(function(btnList){

		var li = this.createLiButton(btnList);
		this.domUl.appendChild(li);

	},this);

};

G.ModifyObjectFactory.prototype.createLiButton = function(btnData){

	var li = document.createElement('li');
	li.className = 'modifyOFli';

	var button = document.createElement('button');

	button.innerHTML = btnData[0];
	button.onclick = btnData[1].bind(this);

	li.appendChild(button);

	return li;

};

G.ModifyObjectFactory.prototype.addToGroup = function(parent,obj) {

	if (parent == game.world || parent == game.state.getCurrentState()) {
		parent = game.world;
		obj.x = game.camera.x+game.width*0.5;
		obj.y = game.camera.y+game.height*0.5;
	}
	if (parent.add) {
		parent.add(obj);
	}else if (parent.addChild) {
		parent.addChild(obj);
	}

	var name;

	var lvlObj = this.modify.currentLevel;

	if (this.defaultNewObjectsNames){
		name = 'child_'+lvlObj.children.length;
	}else {
		name = prompt('Enter object name');
	}

	if (name) {

		obj.___LABEL = name;
		if (parent == game.world) {
			game.state.getCurrentState()[name] = obj;
		}else {
			parent[name] = obj;
		}
	}

	this.onObjectAdded.dispatch(obj);

};

G.ModifyObjectFactory.prototype.addGroup = function() {

	var obj = this.modify.currentLevel;
	var group = game.make.group();
	group.___NEWOBJECT = true;
	this.addToGroup(obj,group);

	return group;

};

G.ModifyObjectFactory.prototype.addImage = function() {

	var obj = this.modify.currentLevel;
	var image = new G.Image(0,0,'__missing',0.5,null);
	image.___NEWOBJECT = true;
	this.addToGroup(obj,image);

	return image;

};


G.ModifyObjectFactory.prototype.addButton = function(){

	var obj = this.modify.currentLevel;
	var button = new G.Button(0,0,'__missing',function(){},this);
	button.___NEWOBJECT = true;
	this.addToGroup(obj,button);

	return button;

};

G.ModifyObjectFactory.prototype.addOneLineText = function() {

	var obj = this.modify.currentLevel;

	var fonts = Object.keys(game.cache._cache.bitmapFont);
	var txt = new G.OneLineText(0,0,fonts[0],'TEXT',50,300,0.5,0.5);
	txt.cacheAsBitmap= false;
	this.addToGroup(obj,txt);

	return txt;
};

G.ModifyObjectFactory.prototype.addMultiLineText = function() {

	var obj = this.modify.currentLevel;

	var fonts = Object.keys(game.cache._cache.bitmapFont);
	var txt = new G.MultiLineText(0,0,fonts[0],'TEXT',50,300,300,'center',0.5,0.5);
	txt.cacheAsBitmap= false;
	this.addToGroup(obj,txt);

	return txt;

};
G.ModifyAnimationEditor = function(modify){

	Phaser.Group.call(this,game);

	this.modify = G.Modify.instance;

	this.tl = new G.ModifyAnimationTL();
	this.tl.x = 100;
	this.add(this.tl);
	
	this.fw = new G.ModifyAnimationFrameWindow();
	this.fw.x = -250;
	this.add(this.fw);

	this.tl.onFrameSelected.add(this.fw.refresh,this.fw);

	this.fw.onChange.add(function(obj,frameNr){
		console.log('fw onchange');
		this.tl.redrawTl();
		obj.updateAnimation(frameNr);
	},this);
	this.tl.changeTlPxWidth(800);

	this.visible = false;

	this.modify.onLevelObjChange.add(function(){

		var obj = this.modify.getCurrentLevelObject();

		if (obj.ANIMATIONELEMENT){
			this.open(obj);
		}else{
			this.close();
		}

	},this);

};

G.ModifyAnimationEditor.prototype = Object.create(Phaser.Group.prototype);

G.ModifyAnimationEditor.prototype.open = function(o){
	this.visible = true;
	this.tl.open(o);
	this.fw.refresh(o,0);

};

G.ModifyAnimationEditor.prototype.close = function(){

	this.visible = false;

}
G.ModifyAnimationFrameGroup = function(x,y){

	Phaser.Group.call(this,game);

	this.x = x;
	this.y = y;

	this.active = false;

	this.currentObj = null;
	this.currentKeyFrame = null;
	this.currentFrameNr = 0;

	this.style = {
		font: 'Verdana',
		fontSize: 13,
		fontWeight: 'bold'
	};

	this.onOffBtn = game.add.text(0,0,'off',this.style);
	this.onOffBtn.inputEnabled = true;
	this.onOffBtn.hitArea = new Phaser.Rectangle(0,0,this.onOffBtn.width,this.onOffBtn.height);
	this.onOffBtn.events.onInputDown.add(this.onOff,this);

	this.propValue = game.add.text(280,0,'---',this.style);
	this.propValue.anchor.x = 1;

	this.addMultiple([this.onOffBtn,this.propValue]);

	this.onChange = new Phaser.Signal();

};

G.ModifyAnimationFrameGroup.prototype = Object.create(Phaser.Group.prototype);

G.ModifyAnimationFrameGroup.prototype.onOff = function(){
		
		if (this.currentFrameNr == 0) return;

		if (this.active){

			this.active = false;
			this.alpha = 0.5;
			this.onOffBtn.setText('off');

			var index = this.currentObj.frameTL.indexOf(this.currentKeyFrame);
			this.currentObj.frameTL.splice(index,1);	

		}else{

			this.active = true;
			this.alpha = 1;
			this.onOffBtn.setText('on');

			var newKeyFrame = {
				f: this.currentFrameNr,
				v: G.Utils.getObjProp(this.currentObj.SPR,'frameName')
			};

			var f = this.currentFrameNr;
			var timeline = this.currentObj.frameTL;

			var indexToPut = 0;
			for (var i = 0; i < timeline.length; i++){
				if (timeline[i].f < f){
					indexToPut++;
				}
			}


			timeline.splice(indexToPut,0,newKeyFrame);

		}

		this.refresh(this.currentObj,this.currentFrameNr);
		//this.onChange.dispatch(this.currentObj,this.frameNr);

};

G.ModifyAnimationFrameGroup.prototype.update = function(){

	if (this.currentObj.playing){
		this.refresh(this.currentObj,this.currentObj.frameCounter);
		return;
	}


	if (this.currentObj){
		var val = G.Utils.getObjProp(this.currentObj.SPR,'frameName') || G.Utils.getObjProp(this.currentObj.SPR,'key');

		if (val.indexOf('/')){
			val = val.slice(val.lastIndexOf('/')+1);
			//*val = val.slice(val.lastIndexOf('.'));
		}

		//show unsaved changes
		if (this.currentKeyFrame == null){
			if ( val != this.valAtRefresh){
				this.propValue.fill = 'red';
				this.alpha = 1;
			}else{
				this.alpha = 0.5;
				this.propValue.fill = 'black';
			}	
		}

		if (!this.currentObj.playing 
			&& this.currentKeyFrame && this.currentKeyFrame.v !== val){
			this.currentKeyFrame.v = val;
		}

		this.propValue.setText(val);

	}else{
		this.propValue.setText('---');
	}

};



G.ModifyAnimationFrameGroup.prototype.refresh = function(obj,frameNr){

	this.currentObj = obj;

	if (!this.currentObj.currentAnimationName) return;


	this.currentKeyFrame = obj.getKeyFrameAt(obj.frameTL,frameNr);
	this.currentFrameNr = frameNr;

	this.propValue.fill = 'black';
	
	this.valAtRefresh = G.Utils.getObjProp(this.currentObj.SPR,'frameName');

	if (this.currentKeyFrame){
		this.active = true;
		this.alpha = 1;

		this.onOffBtn.setText('on');

		console.log('frameGroup refresh');
		console.log(this.currentObj.getTextureFrameValue(obj.frameTL,frameNr));

		this.propValue.setText(this.currentObj.getTextureFrameValue(obj.frameTL,frameNr) || '---');

	}else {
		this.onOffBtn.setText('off');
		this.active = false;
		this.alpha = 0.5;
		this.propValue.setText('---');
	}

};
G.ModifyAnimationFrameWindow = function(){

	Phaser.Group.call(this,game);

	this.onChange = new Phaser.Signal();

	this.gfx =  game.add.graphics();
	this.gfx.inputEnabled = true;
	this.add(this.gfx);

	this.gfx.beginFill(0xdddddd);
	this.gfx.drawRect(0,0,300,500);

	this.style = {
		font: 'Verdana',
		fontSize: 13,
		fontWeight: 'bold'
	};

	this.currentAnimationTxt = game.add.text(10,10,'',this.style);
	this.add(this.currentAnimationTxt);
	this.currentAnimationTxt.inputEnabled = true;
	this.currentAnimationTxt.events.onInputDown.add(function(){
		this.changeAnimation();
	},this);

	this.addAnimationBtn = game.add.text(170,10,'+',this.style);
	this.add(this.addAnimationBtn);
	this.addAnimationBtn.inputEnabled = true;
	this.addAnimationBtn.events.onInputDown.add(this.addNewAnimation,this);

	this.renameAnimationBtn = game.add.text(200,10,'R',this.style);
	this.add(this.renameAnimationBtn);
	this.renameAnimationBtn.inputEnabled = true;
	this.renameAnimationBtn.events.onInputDown.add(this.renameAnimation,this);

	this.removeAnimationBtn = game.add.text(230,10,'-',this.style);
	this.add(this.removeAnimationBtn);
	this.removeAnimationBtn.inputEnabled = true;
	this.removeAnimationBtn.events.onInputDown.add(this.removeAnimation,this);

	this.frameNr = game.add.text(290,10,'',this.style);
	this.frameNr.anchor.x = 1;
	this.add(this.frameNr);

	this.frameGroup = new G.ModifyAnimationFrameGroup(10,50);
	this.add(this.frameGroup);

	this.propGroups = [
		new G.ModifyAnimationPropGroup(10,70,'alpha','#43c9e7'),
		new G.ModifyAnimationPropGroup(10,90,'x','#e08040'),
		new G.ModifyAnimationPropGroup(10,110,'y','#d8ff30'),
		new G.ModifyAnimationPropGroup(10,130,'angle','#072ba0'),
		new G.ModifyAnimationPropGroup(10,150,'scale.x','#6c0674'),
		new G.ModifyAnimationPropGroup(10,170,'scale.y','#d34ed9'),
		new G.ModifyAnimationPropGroup(10,190,'anchor.x'),
		new G.ModifyAnimationPropGroup(10,210,'anchor.y')
	]

	this.propGroups.forEach(function(pg){
		pg.onChange.add(this.onChange.dispatch,this.onChange);
	},this);

	this.addMultiple(this.propGroups);

};

G.ModifyAnimationFrameWindow.prototype = Object.create(Phaser.Group.prototype);

G.ModifyAnimationFrameWindow.prototype.update = function(){

	if (!this.currentObj) return;

	this.propGroups.forEach(function(g){
		g.update();
	},this);

	this.frameGroup.update();

};

G.ModifyAnimationFrameWindow.prototype.loadFrame = function(obj,frameNr){

	this.currentObj = obj;
	this.labelObjTxt.setText(obj.LABEL || 'obj');
	this.frameNr.setText(frameNr);

};

G.ModifyAnimationFrameWindow.prototype.refresh = function(obj,frameNr){

	this.propGroups.forEach(function(pg){
		pg.refresh(obj,frameNr);
	});

	this.frameGroup.refresh(obj,frameNr);

	this.frameNr.setText(frameNr);

	this.currentFrameNr = frameNr;
	this.currentObj = obj;

	this.currentAnimationTxt.setText(this.currentObj.currentAnimationName || '------');

};

G.ModifyAnimationFrameWindow.prototype.changeAnimation = function(name){

	if (!this.currentObj) return;

	var animations = Object.keys(this.currentObj.dataAnimation);
	console.log(JSON.stringify(animations));

	if (name){

		this.currentObj.changeAnimationData(name);

	}else{

		if (this.currentObj.currentAnimationName){
			var index = animations.indexOf(this.currentObj.currentAnimationName);
			var newIndex = (index+1)%animations.length;
			console.log(index,newIndex);
			this.currentObj.changeAnimationData(animations[newIndex]);
		}else{
			this.currentObj.changeAnimationData(animations[0]);
		}

	}

	this.refresh(this.currentObj,this.currentFrameNr);
	this.onChange.dispatch(this.currentObj,0);

};

G.ModifyAnimationFrameWindow.prototype.addNewAnimation = function(){

	if (!this.currentObj) return;

	var animations = Object.keys(this.currentObj.dataAnimation);

	var name = 'newAnimation';
	var number = 0;

	while(animations.indexOf(name+number) !== -1){
		number++;
	}

	this.currentObj.dataAnimation[name+number] = {
		eventTL: [],
		frameTL: [{f:0, v:null}],
		propTLS: {
			alpha: [{f:0,v:1}],
			x: [{f:0,v:0}],
			y: [{f:0,v:0}],
			angle: [{f:0,v:0}],
			'scale.x': [{f:0,v:1}],
			'scale.y': [{f:0,v:1}],
			'anchor.x':  [{f:0,v:0.5}],
			'anchor.y':  [{f:0,v:0.5}]
		}
	}

	this.changeAnimation(name+number);

};

G.ModifyAnimationFrameWindow.prototype.removeAnimation = function(){

	if (!this.currentObj) return;
	if (!this.currentObj.currentAnimationName) return;

	if (Object.keys(this.currentObj.dataAnimation).length == 1) return;

	if (confirm('delete '+this.currentObj.currentAnimationName+'?')){
		delete this.currentObj.dataAnimation[this.currentObj.currentAnimationName];
		this.changeAnimation();
	}

};

G.ModifyAnimationFrameWindow.prototype.renameAnimation = function(){

	if (!this.currentObj) return;
	if (!this.currentObj.currentAnimationName) return;

	G.Modify.instance.domLayer.openInputDiv(
		this.currentObj.currentAnimationName,
		this.currentObj.currentAnimationName,
		function(value){
			var oldName = this.currentObj.currentAnimationName;
			var dataAnimation = this.currentObj.currentAnimationData;

			delete this.currentObj.dataAnimation[oldName];

			this.currentObj.dataAnimation[value] = dataAnimation;
			this.changeAnimation(value);

		},
		this,
		'string'
	);

};
G.ModifyAnimationPropGroup = function(x,y,prop,color){

	Phaser.Group.call(this,game);

	this.x = x;
	this.y = y;

	this.propKey = prop;
	this.active = false;

	this.currentObj = null;
	this.currentKeyFrame = null;
	this.currentFrameNr = 0;

	this.style = {
		font: 'Verdana',
		fontSize: 13,
		fontWeight: 'bold'
	};

	this.easings = [
		'Back','Bounce','Circular','Cubic','Elastic','Exponential','Linear','Quadratic','Quartic','Quintic','Sinusoidal'
	];


	this.onOffBtn = game.add.text(0,0,'off',this.style);
	this.onOffBtn.inputEnabled = true;
	this.onOffBtn.hitArea = new Phaser.Rectangle(0,0,this.onOffBtn.width,this.onOffBtn.height);
	this.onOffBtn.events.onInputDown.add(this.onOff,this);

	this.label = game.add.text(30,0,prop,this.style);
	if (color) this.label.addColor(color,0);

	this.easingLabel0 = game.add.text(120,0,'',this.style);
	this.easingLabel0.inputEnabled = true;
	this.easingLabel0.hitArea = new Phaser.Rectangle(0,0,80,this.easingLabel0.height);
	this.easingLabel0.events.onInputDown.add(this.changeEasing0,this);

	this.easingLabel1 = game.add.text(200,0,'',this.style);
	this.easingLabel1.inputEnabled = true;
	this.easingLabel1.hitArea = new Phaser.Rectangle(0,0,50,this.easingLabel1.height);
	this.easingLabel1.events.onInputDown.add(this.changeEasing1,this);

	this.propValue = game.add.text(280,0,'',this.style);
	this.propValue.anchor.x = 1;

	this.addMultiple([this.label,this.onOffBtn,this.easingLabel0,this.easingLabel1,this.propValue]);

	this.onChange = new Phaser.Signal();

};

G.ModifyAnimationPropGroup.prototype = Object.create(Phaser.Group.prototype);

G.ModifyAnimationPropGroup.prototype.onOff = function(){
		
		if (this.currentFrameNr == 0) return;

		if (this.active){

			this.active = false;
			this.alpha = 0.5;
			this.onOffBtn.setText('off');

			var index = this.currentObj.propTLS[this.propKey].indexOf(this.currentKeyFrame);
			this.currentObj.propTLS[this.propKey].splice(index,1);	

		}else{

			this.active = true;
			this.alpha = 1;
			this.onOffBtn.setText('on');

			var newKeyFrame = {
				f: this.currentFrameNr,
				v: G.Utils.getObjProp(this.currentObj.SPR,this.propKey)
			};

			var f = this.currentFrameNr;
			var timeline = this.currentObj.propTLS[this.propKey];

			var indexToPut = 0;
			for (var i = 0; i < timeline.length; i++){
				if (timeline[i].f < f){
					indexToPut++;
				}
			}
			
			timeline.splice(indexToPut,0,newKeyFrame);

		}

		this.refresh(this.currentObj,this.currentFrameNr);
		//this.onChange.dispatch(this.currentObj,this.frameNr);

};

G.ModifyAnimationPropGroup.prototype.update = function(){

	if (this.currentObj.playing){
		this.refresh(this.currentObj,this.currentObj.frameCounter);
		return;
	}


	if (this.currentObj){
		var val = G.Utils.getObjProp(this.currentObj.SPR,this.propKey);

		//show unsaved changes
		if (this.currentKeyFrame == null){
			if ( val != this.valAtRefresh){
				this.propValue.fill = 'red';
				this.alpha = 1;
			}else{
				this.alpha = 0.5;
				this.propValue.fill = 'black';
			}	
		}

		if (!this.currentObj.playing 
			//&& this.currentObj.frameCounter == this.currentFrameNr 
			&& this.currentKeyFrame && this.currentKeyFrame.v !== val){
			this.currentKeyFrame.v = val;
		}

		this.propValue.setText(val.toFixed(1));

	}else{
		this.propValue.setText('---');
	}

};

G.ModifyAnimationPropGroup.prototype.changeEasing0 = function(){
	
	if (!this.currentKeyFrame) return;

	if (this.currentKeyFrame.e){
		var index = this.easings.indexOf(this.currentKeyFrame.e[0]);

		if (index+1 == this.easings.length){
			this.currentKeyFrame.e = false;
			this.easingLabel0.setText('--');
			this.easingLabel1.setText('--');
		}else{
			this.currentKeyFrame.e[0] = this.easings[index+1];
			this.easingLabel0.setText(this.easings[index+1]);

			var currentE1 = this.currentKeyFrame.e[1];

			if (!Phaser.Easing[this.easings[index+1]][currentE1]){
				if (Phaser.Easing[this.easings[index+1]]['None']){
					this.currentKeyFrame.e[1] = 'None';
				}else if (Phaser.Easing[this.easings[index+1]]['In']){
					this.currentKeyFrame.e[1] = 'In';
				}
			}

			this.easingLabel1.setText(this.currentKeyFrame.e[1]);

		}

	}else {

		this.currentKeyFrame.e = ['Back','In'];
		this.easingLabel0.setText('Back');
		this.easingLabel1.setText('In');

	}

	this.onChange.dispatch(this.currentObj,this.currentFrameNr);

};

G.ModifyAnimationPropGroup.prototype.changeEasing1 = function(){

	if (!this.currentKeyFrame) return;
	if (!this.currentKeyFrame.e) return;

	var currentE1 = this.currentKeyFrame.e[1];
	var keys = Object.keys(Phaser.Easing[this.currentKeyFrame.e[0]]);

	var index = keys.indexOf(currentE1);

	this.currentKeyFrame.e[1] = keys[(index+1)%keys.length];
	this.easingLabel1.setText(this.currentKeyFrame.e[1]);

	this.onChange.dispatch(this.currentObj,this.currentFrameNr);

};



G.ModifyAnimationPropGroup.prototype.refresh = function(obj,frameNr){

	this.currentObj = obj;

	if (!this.currentObj.currentAnimationName) return;


	this.currentKeyFrame = obj.getKeyFrameAt(obj.propTLS[this.propKey],frameNr);
	this.currentFrameNr = frameNr;

	this.propValue.fill = 'black';

	this.valAtRefresh = G.Utils.getObjProp(this.currentObj.SPR,this.propKey);

	if (this.currentKeyFrame){
		this.active = true;
		this.alpha = 1;

		this.onOffBtn.setText('on');

		if (this.currentKeyFrame.e){
			this.easingLabel0.setText(this.currentKeyFrame.e[0]);
			this.easingLabel1.setText(this.currentKeyFrame.e[1]);
		}else{
			this.easingLabel0.setText('---');
			this.easingLabel1.setText('---');
		}

	}else {
		this.onOffBtn.setText('off');
		this.active = false;
		this.alpha = 0.5;
		this.easingLabel0.setText('---');
		this.easingLabel1.setText('---');
	}

};
G.ModifyAnimationTL = function(){

	Phaser.Group.call(this,game);

	this.gfx = game.add.graphics();
	this.add(this.gfx);

	this.tlGfx = game.add.graphics();
	this.tlGfx.inputEnabled = true;

	this.pointerPressed = false;
	this.pointerStartFrame = 0;
	this.tlGfx.events.onInputDown.add(this.onDown,this);
	this.tlGfx.events.onInputUp.add(this.onUp,this);

	this.add(this.tlGfx);

	this.visible = false;
	this.currentObj = null;

	this.frameWidth = 10;
	this.frameHeight = 50;
	this.tlPxWidth = 400;
	this.tlFrameLength = this.tlPxWidth/this.frameWidth;

	this.selectedFrame = null;


	this.frameOffset = 0;

	this.cursors = game.input.keyboard.createCursorKeys();

	this.cursors.left.onDown.add(function(){
		this.frameOffset--;
		this.redrawTl();
	},this);

	this.cursors.right.onDown.add(function(){
		this.frameOffset++;
		this.redrawTl();
	},this);

	this.onFrameSelected = new Phaser.Signal();


};

G.ModifyAnimationTL.prototype = Object.create(Phaser.Group.prototype);

G.ModifyAnimationTL.prototype.colors = [0x972234,0x008b50,0x43c9e7,0xe08040,0xd8ff30,0x072ba0,0x6c0674,0xd34ed9];

G.ModifyAnimationTL.prototype.update = function(){

	if (this.pointerPressed){
		var p = game.input.activePointer;
		var frameNr = Math.floor((p.x - this.tlGfx.worldPosition.x)/this.frameWidth);
		if (frameNr !== this.pointerStartFrame){
			var diff = this.pointerStartFrame-frameNr;
			this.frameOffset += diff;
			this.pointerStartFrame = frameNr;
			this.frameOffset = Math.max(0,this.frameOffset);
			this.redrawTl();

		}
	}


};


G.ModifyAnimationTL.prototype.changeFrameWidth = function(newWidth){
	this.frameWidth = newWidth;
	this.tlFrameLength = Math.floor(this.tlPxWidth/this.frameWidth);
	this.redrawTl();
};

G.ModifyAnimationTL.prototype.changeTlPxWidth = function(newWidth){
	this.tlPxWidth = newWidth;
	this.tlFrameLength = Math.floor(this.tlPxWidth/this.frameWidth);
	this.redrawTl();
};

G.ModifyAnimationTL.prototype.open = function(obj){

	this.currentObj = obj;
	this.visible = true;
	this.redrawTl();
	this.currentObj.stop();

};

G.ModifyAnimationTL.prototype.onDown = function(obj,p){

	this.currentObj.pause();
	var frameNr = Math.floor((p.x - this.tlGfx.worldPosition.x)/this.frameWidth);
	this.pointerStartFrame = frameNr;
	this.pointerPressed = true;
};

G.ModifyAnimationTL.prototype.onUp = function(obj,p){

	var frameNr = Math.floor((p.x - this.tlGfx.worldPosition.x)/this.frameWidth);
	if (this.pointerStartFrame == frameNr){
		this.selectFrame(frameNr);
		this.pointerStar
	}
	this.pointerPressed = false;

};

G.ModifyAnimationTL.prototype.selectFrame = function(frameNr){

	this.selectedFrame = frameNr+this.frameOffset;
	this.currentObj.updateAnimation(this.selectedFrame);
	this.redrawTl();
	this.onFrameSelected.dispatch(this.currentObj,this.selectedFrame);

};

G.ModifyAnimationTL.prototype.redrawTl = function(){
	
	this.tlGfx.clear();

	if (!this.currentObj) return;
	if (!this.currentObj.currentAnimationName) return;

	this.tlGfx.beginFill(0xdddddd,1);
	this.tlGfx.drawRect(0,0,this.tlFrameLength*this.frameWidth,this.frameHeight);

	this.tlGfx.beginFill(0x999999,1);



	for (var i = this.frameOffset; i < this.frameOffset+this.tlFrameLength; i++){

		if (this.currentObj.isAnyKeyFrameAt(i)){
			this.tlGfx.lineStyle(1,0x000000,1);
			this.tlGfx.drawRect(this.frameWidth*i-(this.frameOffset*this.frameWidth),0,this.frameWidth,this.frameHeight);
		}

		if (i % 60 == 0){
			this.tlGfx.lineStyle(1,0x000000,0.25);
			this.tlGfx.moveTo(this.frameWidth*i-(this.frameOffset*this.frameWidth),0);
			this.tlGfx.lineTo(this.frameWidth*i-(this.frameOffset*this.frameWidth),this.frameHeight);
		}
	}



	this.tlGfx.lineStyle(0,0x000000,0);
	//event tl
	for (var i = 0; i < this.currentObj.eventTL.length; i++){
		var key = this.currentObj.eventTL[i];
		this.tlGfx.beginFill(this.colors[0],1);
		if (key.f >= this.frameOffset && key.f < this.frameOffset+this.tlFrameLength){
			this.tlGfx.drawRect(this.frameWidth*key.f-(this.frameOffset*this.frameWidth),0,this.frameWidth,5);
		}
	};

	for (var i = 0; i < this.currentObj.frameTL.length; i++){
		var key = this.currentObj.frameTL[i];
		this.tlGfx.beginFill(this.colors[1],1);
		if (key.f >= this.frameOffset && key.f < this.frameOffset+this.tlFrameLength){
			this.tlGfx.drawRect(this.frameWidth*key.f-(this.frameOffset*this.frameWidth),5,this.frameWidth,5);
		}
	}

	for (var i = 0; i < this.currentObj.propKeys.length; i++){
		this.drawPropLine(this.currentObj.propTLS[this.currentObj.propKeys[i]],15+i*5,this.colors[2+i]);
	}

	if (this.selectedFrame !== null && this.selectedFrame >= this.frameOffset && this.selectedFrame < this.frameOffset+this.tlFrameLength){
		this.tlGfx.beginFill(0x0000ff,0.5);
		this.tlGfx.drawRect(this.frameWidth*this.selectedFrame-(this.frameOffset*this.frameWidth),0,this.frameWidth,this.frameHeight);
	}

};

G.ModifyAnimationTL.prototype.drawPropLine = function(tl, y, color){

	var x;
	var w = this.frameWidth*0.5;

	for (var i = 0; i < tl.length; i++){
		var kf = tl[i];


		x = (kf.f*this.frameWidth+(this.frameWidth*0.5))-(this.frameOffset*this.frameWidth);
		
		this.tlGfx.lineStyle(0,0,0);

		if (kf.f < this.frameOffset) continue;
		

		//check if there was easing in prev key

		var pkf = tl[i-1];
		if (pkf && pkf.e){
			this.tlGfx.lineStyle(2,color,1);
			this.tlGfx.moveTo(0,y);
			this.tlGfx.lineTo(
				Math.min(
					this.tlFrameLength*this.frameWidth,
					kf.f*this.frameWidth-(this.frameOffset*this.frameWidth)
				),y);
		};

		if (kf.f >= this.frameOffset+this.tlFrameLength) continue;

		if (kf.e){
			this.tlGfx.beginFill(color,1);
			this.tlGfx.drawCircle(x,y,w);

			if (tl[i+1]){
				this.tlGfx.lineStyle(2,color,1);
				this.tlGfx.moveTo(x,y);
				var lineToX = tl[i+1].f*this.frameWidth-(this.frameOffset*this.frameWidth);
				lineToX = Math.min(this.tlFrameLength*this.frameWidth,lineToX);
				this.tlGfx.lineTo(lineToX,y);
			}

		}else{
			this.tlGfx.endFill();
			this.tlGfx.lineStyle(2,color,1);
			this.tlGfx.drawCircle(x,y,w-2);
		}

	}

};
G.ModifyDOMAnimationProp = function(propName,color){

	var animProp = this;

	this.mainDiv = document.createElement('div');

	this.onOffBtn = document.createElement('button');
	this.onOffBtn.innerHTML = 'ON';
	this.mainDiv.appendChild(this.onOffBtn);

	this.label = document.createElement('span');
	this.label.innerHTML = propName;
	this.label.style.color = color;
	this.label.style.fontWeight = 'bold';
	this.label.style.width = '60px';
	this.label.style.display = 'inline-block';
	this.mainDiv.appendChild(this.label);

	this.easingTypeList = document.createElement('select');
	this.easings = ['---','Back','Bounce','Circular','Cubic','Elastic','Exponential','Linear','Quadratic','Quartic','Quintic','Sinusoidal'];
	this.easings.forEach(function(easing){
		var option = document.createElement('option');
		option.setAttribute('value',easing);
		option.innerHTML = easing;
		this.easingTypeList.appendChild(option);
	},this);
	this.mainDiv.appendChild(this.easingTypeList);

	this.easingTypeList.onchange = function(){
		animProp.changeEasing(this.value);
	};

	this.easingSubtypeList = document.createElement('select');
	this.easingSubtypeList.onchange = function(){
		animProp.changeEasingSubtype(this.value);
	};
	this.mainDiv.appendChild(this.easingSubtypeList);

	this.propValue = document.createElement('span');
	this.propValue.innerHTML = '--';
	this.propValue.style.display = 'inline-block';
	this.mainDiv.appendChild(this.propValue);

	this.active = false;


	this.mainDiv.style.position = 'fixed';
	this.mainDiv.style.top = '0';
	this.mainDiv.style.left = '100px';

	document.body.appendChild(this.mainDiv);

	this.currentKeyFrame = {e:[]};

};

G.ModifyDOMAnimationProp.prototype.onOff = function(){

	if (this.active){

		this.active = false;
		this.onOffBtn.innerHTML = 'OFF';
		var index = this.currentObj.propTLS[this.propKey].indexOf(this.currentKeyFrame);
		this.currentObj.propTLS[this.propKey].splice(index,1);	

	}else{

		this.active = true;
		this.onOffBtn.innerHTML = 'ON';

		var newKeyFrame = {
			f: this.currentFrameNr,
			v: G.Utils.getObjProp(this.currentObj.SPR,this.propKey)
		};

		var f = this.currentFrameNr;
		var timeline = this.currentObj.propTLS[this.propKey];

		//why not push and sort??
		var indexToPut = 0;
		for (var i = 0; i < timeline.length; i++){
			if (timeline[i].f < f){
				indexToPut++;
			}
		}

	}

};

G.ModifyDOMAnimationProp.prototype.changeEasing = function(easing){

	if (!this.currentKeyFrame) return;

	if (easing !== '---'){
		this.currentKeyFrame.e[0] = easing;
	}else{
		this.currentKeyFrame.e = [];
		this.refreshSubtypeList();
		this.selectFromList(this.easingSubtypeList,'---');
		return;
	}

	this.selectFromList(this.easingTypeList,easing);

	var currentE1 = this.currentKeyFrame.e[1];
	this.refreshSubtypeList();

	if (!Phaser.Easing[easing][currentE1]){
		this.changeEasingSubtype(Object.keys(Phaser.Easing[easing])[0]);
	}else{
		this.changeEasingSubtype(currentE1);
	}

};

G.ModifyDOMAnimationProp.prototype.changeEasingSubtype = function(subtype){

	console.log('changeSubtype: '+subtype);

	this.selectFromList(this.easingSubtypeList,subtype);
	if (subtype !== '---') this.currentKeyFrame.e[1] = subtype;

};

G.ModifyDOMAnimationProp.prototype.refreshSubtypeList = function(){

	var e = Phaser.Easing[this.easingTypeList.value];

	this.easingSubtypeList.innerHTML = '';

	if (e){

		for (prop in e){
			var option = document.createElement('option');
			option.setAttribute('value',prop);
			option.innerHTML = prop;
			this.easingSubtypeList.appendChild(option);
		}

	}else{

		var option = document.createElement('option');
		option.setAttribute('value','---');
		option.innerHTML = '---';
		this.easingSubtypeList.appendChild(option);

	}

};

G.ModifyDOMAnimationProp.prototype.selectFromList = function(list,value){

	for (var i = 0; i < list.options.length; i++){
		if (list.options[i].value === value){
			list.selectedIndex = i;
			break;
		}
	}

};
G.ModifyDOMButtonGroup = function(modify){

	this.modify = modify;


	this.posBtn = document.createElement('div');
	this.posBtn.style.width = '10px';
	this.posBtn.style.height = '10px';
	this.posBtn.style.position = 'fixed';
	this.posBtn.style.backgroundColor = 'red';
	this.posBtn.draggable = 'true';
	this.posBtn.ondrag = this.posDragHandler.bind(this);
	this.posBtn.style.border = '1px solid';
	//this.posBtn.style.transform = 'translateX(-50%) translateY(-50%)';
	document.body.appendChild(this.posBtn);

	this.scaleBtn = document.createElement('div');
	this.scaleBtn.style.width = '10px';
	this.scaleBtn.style.height = '10px';
	this.scaleBtn.style.position = 'fixed';
	this.scaleBtn.style.backgroundColor = 'green';
	this.scaleBtn.draggable = 'true';
	this.scaleBtn.onclick = function(){console.log('click')};
	this.scaleBtn.ondrag = this.scaleDragHandler.bind(this);
	this.scaleBtn.ondragstart = function(){console.log('ondragstart')};
	this.scaleBtn.style.border = '1px solid';
	//this.scaleBtn.style.transform = 'translateX(-50%) translateY(-50%)';
	document.body.appendChild(this.scaleBtn);

	this.angleBtn = document.createElement('div');
	this.angleBtn.style.width = '10px';
	this.angleBtn.style.height = '10px';
	this.angleBtn.style.position = 'fixed';
	this.angleBtn.style.backgroundColor = 'blue';
	this.angleBtn.draggable = 'true';
	this.angleBtn.ondrag = this.angleDragHandler.bind(this);
	this.angleBtn.style.border = '1px solid';
	//this.angleBtn.style.transform = 'translateX(-50%) translateY(-50%)';
	document.body.appendChild(this.angleBtn); 
	

	this.bindedUpdateTransformButtons = this.updateTransformButtons.bind(this);

	window.requestAnimationFrame(this.bindedUpdateTransformButtons);

};

G.ModifyDOMButtonGroup.prototype.updateTransformButtons = function(){


	if (!this.dragging){

		var obj = this.modify.currentObject;

		if (obj){

			
			var bounds = obj.getBounds();
			

			this.posBtn.style.display = 'block';
			this.posBtn.style.left = G.Utils.toClientX(obj.worldPosition.x)+'px';
			this.posBtn.style.top = G.Utils.toClientY(obj.worldPosition.y)+'px';



			this.scaleBtn.style.display = 'block';
			//this.scaleBtn.style.left = G.Utils.toClientX(obj.worldPosition.x+(obj.width*obj.worldScale.x))+'px';
			//this.scaleBtn.style.top = G.Utils.toClientY(obj.worldPosition.y+(obj.height*obj.worldScale.y))+'px';

			

			var lb = obj.getLocalBounds();
			var anchorXFromLocalBounds = lb.x/lb.width*-1;
			var anchorYFromLocalBounds = lb.y/lb.height*-1;
			


			var bounds = obj.getBounds();


			var xx = bounds.x+(bounds.width*anchorXFromLocalBounds)+(bounds.width*(1-anchorXFromLocalBounds)*Math.sign(obj.worldScale.x));
			var yy = bounds.y+(bounds.height*anchorYFromLocalBounds)+(bounds.height*(1-anchorYFromLocalBounds)*Math.sign(obj.worldScale.y));

			this.scaleBtn.style.left = G.Utils.toClientX(xx)+'px';
			this.scaleBtn.style.top = G.Utils.toClientY(yy)+'px';


			var s = Math.sin(obj.worldRotation);
			var c = Math.cos(obj.worldRotation);
			var tx = c*25;
			var ty = s*25;

			this.angleBtn.style.display ='block';
			this.angleBtn.style.left = G.Utils.toClientX(obj.worldPosition.x+tx)+'px';
			this.angleBtn.style.top = G.Utils.toClientY(obj.worldPosition.y+ty)+'px';



		}else{
			this.posBtn.style.display = 'none';
			this.scaleBtn.style.display = 'none';
		}

	}

	window.requestAnimationFrame(this.bindedUpdateTransformButtons);

};


G.ModifyDOMButtonGroup.prototype.posDragHandler = function(event){


	var obj = this.modify.currentObject;

	if (obj){

		//because on drop handler will fire at 0,0
		if (event.pageX == 0 && event.pageY == 0){
			return;
		}

		this.modify.moveCurrentObjectToWorldPos(
			G.Utils.clientXToWorldX(event.clientX),
			G.Utils.clientYToWorldY(event.clientY));

	}

};



G.ModifyDOMButtonGroup.prototype.scaleDragHandler = function(event){


	var obj = this.modify.currentObject;

	if (obj){

		if(!this.prevScalePosition){
			this.prevScalePosition = {x: event.clientX, y: event.clientY};
			return;
		}

		//because on drop handler will fire at 0,0
		if (event.pageX == 0 && event.pageY == 0){
			this.prevScalePosition = false;

			if (event.shiftKey){
				obj.scale.y = obj.scale.x;
			}

			this.modify.modifyCurrentObjProp('width',Math.floor(obj.width));
			this.modify.modifyCurrentObjProp('height',Math.floor(obj.height));

			return;
		}



		var xdiff = event.clientX-this.prevScalePosition.x;
		var ydiff = event.clientY-this.prevScalePosition.y;

		this.modify.modifyCurrentObjProp('width',obj.width+xdiff);
		this.modify.modifyCurrentObjProp('height',obj.height+ydiff);

		if (event.shiftKey){
				obj.scale.y = obj.scale.x;
				this.modify.modifyCurrentObjProp('width',Math.floor(obj.width));
				this.modify.modifyCurrentObjProp('height',Math.floor(obj.height));
		}

		this.prevScalePosition.x = event.clientX;
		this.prevScalePosition.y = event.clientY;


	}

};


G.ModifyDOMButtonGroup.prototype.angleDragHandler = function(event){


	var obj = this.modify.currentObject;

	if (obj){

		if(!this.prevAnglePosition){
			this.prevAnglePosition = {x: event.clientX, y: event.clientY};
			return;
		}

		//because on drop handler will fire at 0,0
		if (event.pageX == 0 && event.pageY == 0){
			this.prevAnglePosition = false;
			return;
		}


		var rotation = game.math.angleBetween(
				G.Utils.toClientX(obj.worldPosition.x),
				G.Utils.toClientY(obj.worldPosition.y),
				event.clientX,
				event.clientY
				)-obj.parent.worldRotation;

		this.modify.modifyCurrentObjProp('rotation',rotation);

		this.prevAnglePosition.x = event.clientX;
		this.prevAnglePosition.y = event.clientY;


	}

};


G.ModifyDOMButtonGroup.prototype.destroy = function(){

	this.scaleBtn.remove();
	this.posBtn.remove();

};
G.ModifyDOMChildList = function(modify){

	G.Utils.injectCSS(this.cssClasses.join('\n'));

	this.modify = modify;

	this.mainDiv = document.createElement('div');
	this.mainDiv.className = 'modifyCLmainDiv';
	document.body.append(this.mainDiv);


	this.goToTopBtn = document.createElement('button');
	this.goToTopBtn.className = 'modifyCLButton modifyCLButtonLevel';
	this.goToTopBtn.innerHTML = 'T';
	this.goToTopBtn.onclick = function(){
		modify.currentLevelGoUp();
	};

	this.levelSpan = document.createElement('span');
	this.levelSpan.className = 'modifyCLlevelSpan';

	this.mainDiv.appendChild(this.goToTopBtn);
	this.mainDiv.appendChild(this.levelSpan);

	this.list = document.createElement('ul');
	this.list.style.display = 'block';
	this.list.className = 'modifyCLul';
	this.mainDiv.appendChild(this.list);

	this.modify.onLevelObjChange.add(this.refreshList,this);
	this.modify.onCurrentObjChange.add(this.highlightCurrent,this);
	this.modify.onObjDestroy.add(this.refreshList,this);
};


G.ModifyDOMChildList.prototype.cssClasses = [
	'.modifyCLlevelSpan {font-weight: bold; font-size: 0.7em;}',
	//'.modifyCLmainDiv {position: fixed; top: 0; font-family: verdana; left: 0; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none;}',
	'.modifyCLmainDiv {font-family: verdana; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none;}',
	'.modifyCLButton {pointer-events: all; margin: 0; border: 0; background-color: rgba(200,200,200,0.5); font-weight: bold; font-size: 0.7em;}',
	'.modifyCLButtonSelection {background-color: rgba(255,255,255,1)}',
	'.modifyCLButtonLevel {background-color: rgba(0,0,200,0.5)}',
	'.modifyCLButtonLevelHasChildren {background-color: rgba(0,200,0,0.5)}',
	'.modifyCLli {margin: 0; padding: 0;}',
	".modifyCLul {margin: 0; margin-top: 10px; padding: 0; line-style: none;}" 
];


G.ModifyDOMChildList.prototype.onCurrentObjChange = function(){};

G.ModifyDOMChildList.prototype.toggleList = function(){

	this.list.style.display = this.list.style.display == 'block' ? 'none' : 'block';

};

G.ModifyDOMChildList.prototype.highlightCurrent = function(){

	for (var i = 0; i < this.list.children.length; i++){
		var btn = this.list.children[i].children[0];
		if (this.modify.currentObject == btn.childData.obj){
			btn.className = 'modifyCLButton modifyCLButtonSelection';
		}else{
			btn.className = 'modifyCLButton';
		}
	}

};

G.ModifyDOMChildList.prototype.refreshList = function(obj){

	var childrenData = this.modify.getChildrenData(obj);

	this.levelSpan.innerHTML = this.modify.getChildLabel(obj);

	this.list.innerHTML = '';

	childrenData.forEach(function(childData){

		var childLi = this.createChildLi(childData);
		this.list.appendChild(childLi);

	},this);

	this.highlightCurrent();

};


G.ModifyDOMChildList.prototype.createChildLi = function(childData){
	//for closure
	var modify = this.modify;

	var li = document.createElement('li');
	li.className = 'modifyCLli';

	var btn = document.createElement('button');
	btn.className = 'modifyCLButton';
	btn.childData = childData;
	btn.onclick = function(){
		modify.changeCurrentObject(this.childData.obj);
	};

	li.appendChild(btn);

	btn.innerHTML = childData.label;

	if (childData.openable){

		var levelBtn = document.createElement('button');

		if (childData.hasChildren){
			levelBtn.className = 'modifyCLButton modifyCLButtonLevelHasChildren';
		}else{
			levelBtn.className = 'modifyCLButton modifyCLButtonLevel';
		}
		
		levelBtn.childData = childData;

		levelBtn.onclick = function(){
			modify.changeLevelObject(this.childData.obj);
		};

		levelBtn.innerHTML = '+';
		li.appendChild(levelBtn);

	}

	return li;

};
G.ModifyDOMFrameSelector = function(){

	G.Utils.injectCSS(this.css.join('\n'));

		var frameSelector = this;

	this.mainDiv = document.createElement('div');
	this.mainDiv.className = 'mDOMfsmain';
	this.mainDiv.style.backgroundColor = 'gray';

	document.body.appendChild(this.mainDiv);

	this.selectList = document.createElement('select');
	this.mainDiv.appendChild(this.selectList);

	this.plusBtn = document.createElement('button');
	this.plusBtn.innerHTML = '+';
	this.plusBtn.onclick = function(){
		frameSelector.changeImgBtnsSize(10);
	};
	this.mainDiv.appendChild(this.plusBtn);

	this.minusBtn = document.createElement('button');
	this.minusBtn.innerHTML = '-';
	this.minusBtn.onclick = function(){
		frameSelector.changeImgBtnsSize(-10);
	};
	this.mainDiv.appendChild(this.minusBtn);

	this.closeBtn = document.createElement('button');
	this.closeBtn.innerHTML = 'X';
	this.closeBtn.onclick = function(){
		frameSelector.close();
	}
	this.mainDiv.appendChild(this.closeBtn);

	this.pageContainer = document.createElement('div');
	this.pageContainer.className = 'mDOMpageContainer';
	this.mainDiv.appendChild(this.pageContainer);

	this.atlasPages = [];

	this.selectList.onchange = function(e){
		frameSelector.selectPage(this.value);
	};

	this.loadAtlases();

	this.selectPage('IMAGES');
	this.close();

	this.onFrameClicked = new Phaser.Signal();

};

G.ModifyDOMFrameSelector.prototype.css = [
	'.mDOMfsmain {position: fixed; top: 0; right: 0; height: 100%; width: 210px;}',
	'.mDOMpageContainer {height: 95%; overflow-y: scroll;}',
	'.mDOMpageContainer::-webkit-scrollbar {width: 5px;}',
	'.mDOMpageContainer::-webkit-scrollbar-track {-webkit-box-shadow: inset 0 0 6px rgba(0,0,0,0.3);}',
	'.mDOMpageContainer::-webkit-scrollbar-thumb {background-color: darkgrey; outline: 1px solid slategray;}'
];

G.ModifyDOMFrameSelector.prototype.toggle = function(){

	this.mainDiv.style.display = this.mainDiv.style.display == 'block' ? 'none' : 'block';

};

G.ModifyDOMFrameSelector.prototype.open = function(){
	this.mainDiv.style.display = 'block';
};

G.ModifyDOMFrameSelector.prototype.close = function(){
	this.mainDiv.style.display = 'none';
};

G.ModifyDOMFrameSelector.prototype.destroy = function(){

	this.mainDiv.remove();

};

G.ModifyDOMFrameSelector.prototype.changeImgBtnsSize = function(change){

	this.atlasPages.forEach(function(page){

		page.imgBtns.forEach(function(btn){

			var cs = parseInt(btn.style.width);
			var newSize = cs+change > 30 ? cs+change : 30;
			btn.style.width = newSize+'px';
			btn.style.height = newSize+'px';

		});

	});

};

G.ModifyDOMFrameSelector.prototype.selectPage = function(atlasName){

	this.atlasPages.forEach(function(page){
		page.style.display = page.atlasName === atlasName ? 'block' : 'none';
	});

};

G.ModifyDOMFrameSelector.prototype.loadAtlases = function(){

	var imgCache = game.cache._cache.image;

	this.makeAtlasPage('IMAGES');

	for (prop in imgCache){

		//skop default and missing
		if (prop[0] == '_' && prop[1] == '_') continue;

		//singleImg
		if (!imgCache[prop].frame){
			this.makeAtlasPage(prop);
		}

	}

};

G.ModifyDOMFrameSelector.prototype.makeAtlasPage = function(atlasName){

	var option = document.createElement('option');
	option.setAttribute('value',atlasName);
	option.innerHTML = atlasName;
	this.selectList.appendChild(option);

	var page = document.createElement('div');
	page.imgBtns = [];

	page.atlasName = atlasName;

	var frameNames;

	if (atlasName == 'IMAGES'){
		frameNames = {};

		var cache = game.cache._cache.image;
		for (imgKey in cache){
			if (imgKey.indexOf('__') == 0) continue;
			if (cache[imgKey].frame) {
				frameNames[imgKey] = true;
			}
		}

	}else{
		frameNames = game.cache.getFrameData(atlasName)._frameNames;
	}


	for (img in frameNames){
		var btn = this.makeImageBtn(img);
		page.imgBtns.push(btn);
		page.appendChild(btn);
	}

	this.pageContainer.appendChild(page);
	this.atlasPages.push(page);

};


G.ModifyDOMFrameSelector.prototype.makeImageBtn = function(imgName){

	var frameSelector = this;

	var img = document.createElement('img');
	img.src = G.Utils.getImageURI(imgName);
	img.style.width = '50px';
	img.style.height = '50px';
	img.imgName = imgName;
	img.onclick = function(){
		frameSelector.onFrameClicked.dispatch(this.imgName);
	}	

	return img;

};
G.ModifyDOMLayer = function(modify){

	this.modify = modify;

	this.openElement = null;

	this.extraDataDiv = this.initExtraDataDiv();
	this.inputDataDiv = this.initInputDiv();

};

G.ModifyDOMLayer.prototype.closeCurrent = function(){

	game.time.events.add(1,function(){
		game.input.enabled = true;
	});
	this.openElement.style.display = 'none';
	game.canvas.focus();

};

G.ModifyDOMLayer.prototype.initExtraDataDiv = function(){

	var dataInputDiv = document.createElement('DIV');
	dataInputDiv.style.backgroundColor = 'green';
	dataInputDiv.style.left = '10%';
	dataInputDiv.style.top = '10%';
	dataInputDiv.style.position = 'fixed';
	dataInputDiv.style.width = '80%';
	dataInputDiv.style.height = '80%';

	var input = document.createElement('TEXTAREA');
	input.style.marginTop = '2%';
	input.style.marginLeft = '2%';
	input.style.width = '95%';
	input.style.height = '94%';
	input.style.resize = 'none';

	input.onkeydown = (function(e){

		var textarea = e.target;
		var div = dataInputDiv;

		//check if data is correct
	    game.time.events.add(1, function(){
	    	try {
				eval('var tmp = '+textarea.value);
				if (typeof tmp === 'object'){
					div.style.backgroundColor = 'green';
					div.proper = true;
				}else {
					div.style.backgroundColor = 'red';
					div.proper = false;
				}
			}catch(e){
				div.style.backgroundColor = 'red';
				div.proper = false;
			}
	    });


	    if(e.keyCode==9 || e.which==9){
	        e.preventDefault();
	        var s = textarea.selectionStart;
	        textarea.value = textarea.value.substring(0,textarea.selectionStart) + "\t" + textarea.value.substring(textarea.selectionEnd);
	        textarea.selectionEnd = s+1; 
	    }

	    if(e.keyCode == 83 && e.ctrlKey) {
	    	e.preventDefault();
	    	if (div.proper){
	    		this.closeCurrent();
	    		div.callback.call(div.context,textarea.value);
	    	}
	    	return false;

	    }

	    if (e.keyCode == 27) {
			this.closeCurrent();
	    } 

	}).bind(this);

	dataInputDiv.textarea = input;

	dataInputDiv.appendChild(input);
	document.body.appendChild(dataInputDiv);
	
	dataInputDiv.style.display = 'none';
	dataInputDiv.style.position = 'fixed';


	return dataInputDiv;

};

G.ModifyDOMLayer.prototype.openExtraData = function(label,data,callback,context){

	console.log('openExtraData');

	this.openElement = this.extraDataDiv;

	this.extraDataDiv.style.backgroundColor = 'green';
	this.extraDataDiv.callback = callback || function(){};
	this.extraDataDiv.context = context || this;

	this.extraDataDiv.style.display = 'block';
	game.input.enabled = false;

	if (data) {
		if (typeof data === 'object'){
			data = JSON.stringify(data,null,"\t");
		}
	}else {
		data = '';
	}

	this.extraDataDiv.textarea.value = data;

	game.time.events.add(1,function(){
		this.extraDataDiv.textarea.focus();
	},this);

};


G.ModifyDOMLayer.prototype.initInputDiv = function(){

	var inputDiv = document.createElement('DIV');
	inputDiv.style.backgroundColor = 'gray';
	inputDiv.style.left = '30%';
	inputDiv.style.top = '10%';
	inputDiv.style.position = 'fixed';
	inputDiv.style.width = '40%';
	inputDiv.style.textAlign = 'center';
	inputDiv.style.padding = '10px';
	inputDiv.style.fontFamily = 'Verdana';

	var span = document.createElement('h3');

	var filterLabel = document.createElement('SPAN');
	filterLabel.style.float = 'right';

	var initValue = document.createElement('SPAN');
	initValue.style.float = 'left';

	span.innerHTML = '';

	var input = document.createElement('INPUT');
	input.style.width = '90%';
	input.style.fontSize = '25px';

	input.onkeydown = (function(e){

		var textarea = e.target;
		var div = inputDiv;

	    if((e.keyCode == 83 && e.ctrlKey) || (e.keyCode == 13)) {
	    	e.preventDefault();

	    	var filteredValue = div.filter(textarea.value);

	    	if (filteredValue === undefined){

	    		div.style.backgroundColor = 'red';
	    		game.time.events.add(50,function(){
	    			div.style.backgroundColor = 'gray';
	    		});


	    	}else{

	    		this.closeCurrent();
    			div.callback.call(div.context,filteredValue);

	    	}
	    	return false;
	    }

	    if (e.keyCode == 27) {
			this.closeCurrent();
	    } 

	}).bind(this);

	inputDiv.appendChild(span);
	inputDiv.appendChild(input);
	inputDiv.appendChild(filterLabel);
	inputDiv.appendChild(initValue);
	document.body.appendChild(inputDiv);

	inputDiv.span = span;
	inputDiv.textarea = input;
	inputDiv.input = input;
	inputDiv.filterLabel = filterLabel;
	inputDiv.initValue = initValue;

	inputDiv.filters = {
		number: function(value){
			var parsed = parseFloat(value);
			if (isNaN(parsed)){
				return undefined;
			}else{
				return parsed;
			}
		},
		string: function(value){

			if (value.length == 0) return undefined;

			return value;
		},
		none: function(value){
			return value;
		}
	}

	inputDiv.style.display = 'none';
	inputDiv.style.position = 'fixed';

	return inputDiv;

};

G.ModifyDOMLayer.prototype.openInputDiv = function(label,initValue,callback,context,filter){

	if (!this.inputDataDiv){
		this.initInputArea();
	}

	this.openElement = this.inputDataDiv;

	this.inputDataDiv.style.display = 'block';
	game.input.enabled = false;

	this.inputDataDiv.span.innerHTML = label || '';

	this.inputDataDiv.input.value = initValue;

	this.inputDataDiv.callback = callback || function(){};
	this.inputDataDiv.context = context || this;

	filter = filter || 'none';
	this.inputDataDiv.filter = this.inputDataDiv.filters[filter];
	this.inputDataDiv.filterLabel.innerHTML = filter;

	this.inputDataDiv.initValue.innerHTML = 'init val: '+initValue;

	game.time.events.add(1,function(){
		this.inputDataDiv.input.focus();
		this.inputDataDiv.input.select();
	},this);

};


G.ModifyDOMPropButton = function(modify,label,refreshFunc,setFunc,postSet){

	this.modify = modify;

	this.domElement = document.createElement('li');
	this.domButton = document.createElement('button');
	this.domLabel = document.createElement('span');
	this.domLabel.innerHTML = label+': ';
	this.domButton.appendChild(this.domLabel);
	this.domValue = document.createElement('span');
	this.domButton.appendChild(this.domValue);
	this.domElement.appendChild(this.domButton);

	if (typeof refreshFunc === 'string') {
		this.refreshProp = refreshFunc.split('.');
	}else {
		this.refreshFunc = refreshFunc;
	}

	if (typeof setFunc === 'string'){
		this.filterProperty = setFunc.slice(0,setFunc.indexOf(':'));
		this.setProp =	setFunc.slice(setFunc.indexOf(':')+1).split('.');
		this.setFunc = this.openInput;
	}else{
		this.setFunc = setFunc;
	}

	this.postSet = postSet;

	this.domButton.onclick = this.setFunc.bind(this);

};

G.ModifyDOMPropButton.prototype.setFunc = function(){

	var obj = this.modify.getCurrentObject();

	if (!obj) return;

	var value = this[this.askFunc]();

	if (value === null) return;

	this.modify.modifyCurrentObjProp(this.refreshProp,value);

	if (this.postSet){
		this.postSet(obj,value);
	}

};


G.ModifyDOMPropButton.prototype.openInput = function(){

	var obj = this.modify.getCurrentObject();

	if (!obj) return;

	this.modify.domLayer.openInputDiv(
		this.modify.getChildLabel(obj)+' | '+this.setProp,
		G.Utils.getObjProp(obj,this.setProp),
		function(value){
			this.modify.modifyCurrentObjProp(this.refreshProp,value);
			if (this.postSet){
				this.postSet(obj,value);
			}
		},
		this,
		this.filterProperty);

};

G.ModifyDOMPropButton.prototype.refreshFunc = function(obj){

	this.domValue.innerHTML = '---';

	var obj = this.modify.getCurrentObject();

	if (!obj) {
		this.domElement.style.display = 'none';
		return;
	}

	var currentObj = obj;

	var val = G.Utils.getObjProp(obj,this.refreshProp);

	if (val === undefined){
		this.domElement.style.display = 'none';
	}else{
		this.domElement.style.display = 'list-item';
		if (typeof val === 'number'){
			val = val.toFixed(2);
		}

		this.domValue.innerHTML = val;
	}

};
G.ModifyDOMPropList = function(modify){

	G.Utils.injectCSS(this.cssClasses.join('\n'));

	this.modify = modify;

	this.buttons = [];

	this.mainDiv = document.createElement('div');
	this.mainDiv.className = 'modifyPLmainDiv';
	this.list = document.createElement('ul');
	this.list.className = 'modifyPLul';
	this.mainDiv.appendChild(this.list);

	this.addButton('x','x','number:x');
	this.addButton('y','y','number:y');
	this.addButton('width','width','number:width');
	this.addButton('height','height','number:height');
	this.addButton('scale.x','scale.x','number:scale.x');
	this.addButton('scale.y','scale.y','number:scale.y');
	this.addButton('angle','angle','number:angle');
	this.addButton('alpha','alpha','number:alpha');
	this.addButton('visible','visible',function(){
		var obj = modify.currentObject;
		modify.modifyCurrentObjProp('visible',!obj.visible);
	});
	this.addButton('anchor.x','anchor.x','number:anchor.x');
	this.addButton('anchor.y','anchor.y','number:anchor.y');
	this.addButton('frame','frameName',function(){
		modify.frameSelector.open();
	});
	this.addButton('fontSize','fontSize','number:fontSize',function(obj,value){

		if (obj.cacheAsBitmap){
			obj.orgFontSize = value;
			if (obj.setText) obj.setText(obj.text);
		}

		//in case of labelgroup
		if (obj.refresh) obj.refresh();
	});
	this.addButton('font','font',function(){

		var obj = modify.getCurrentObject();

		var keys = Object.keys(game.cache._cache.bitmapFont);
		var fontIndex = keys.indexOf(obj.font);
		modify.modifyCurrentObjProp('font',keys[(fontIndex+1)%keys.length]);
		if (obj.cacheAsBitmap){
			if (obj.setText) obj.setText(obj.text);
		}

		//in case of labelgroup
		if (obj.refresh) obj.refresh();
	});
	this.addButton('text','text','string:text',function(obj){
		if (obj.cacheAsBitmap){
			if (obj.setText) obj.setText(obj.text);
		}
	});
	this.addButton('maxUserWidth','maxUserWidth','number:maxUserWidth',function(obj,value){
		if (obj.cacheAsBitmap){
			obj.setText(obj.text);
		}
	});
	this.addButton('maxUserHeight','maxUserHeight','number:maxUserHeight',function(obj,value){
		if (obj.cacheAsBitmap){
			obj.setText(obj.text);
		}
	});
	this.addButton('fixedToCamera','fixedToCamera',function(){
		var obj = modify.getCurrentObject();
		modify.modifyCurrentObjProp('fixedToCamera',!obj.fixedToCamera);
	});

	this.addButton('cameraOffset.x','cameraOffset.x','number:cameraOffset.x');
	this.addButton('cameraOffset.y','cameraOffset.y','number:cameraOffset.y');
	this.addButton('EXTRA_DATA',function(){

			var obj = this.modify.getCurrentObject();

			this.domElement.style.display = 'list-item';

			if (!obj) {
				this.domElement.style.display = 'none';
				return;
			}

			if (obj && obj.___DATA) {
				this.domValue.innerHTML = 'YES'
			}else {
				this.domValue.innerHTML = '---'
			}	

	},function(){

		var obj = this.modify.getCurrentObject();

		this.modify.domLayer.openExtraData(obj.label, obj.___DATA || {},function(newData){

			//means empty string
			if (!newData) {
				delete obj.___DATA;
			}else {

				try {
					eval('var tmp = '+newData);

					if (typeof tmp === 'object'){

						obj.___DATA = tmp;
						this.refreshFunc();

						//obj.___DATAPARSED = tmp;
					}else {
						console.warn('extra data cannot be a string');
					}

				}catch(e){
					console.warn('something went wrong with parsing value');
				}

			}

		});

	});

	this.modify.onLevelObjChange.add(this.refreshValues,this);
	this.modify.onCurrentObjChange.add(this.refreshValues,this);
	this.modify.onCurrentObjPropModified.add(this.refreshValues,this);

};

G.ModifyDOMPropList.prototype.addButton = function(label,refreshFunc,setFunc,postSet){
	
	var button = new G.ModifyDOMPropButton(this.modify,label,refreshFunc,setFunc,postSet);
	this.buttons.push(button);
	button.domButton.className = 'modifyPLButton';

	this.list.appendChild(button.domElement);
};

G.ModifyDOMPropList.prototype.refreshValues = function(){

	this.buttons.forEach(function(button){
		button.refreshFunc();
	});

};

G.ModifyDOMPropList.prototype.cssClasses = [
'.modifyPLmainDiv {font-family: verdana; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none;}',
'.modifyPLButton {pointer-events: all; margin: 0; border: 0; background-color: rgba(100,200,200,0.5); font-weight: bold; font-size: 0.7em;}',
".modifyPLul {margin: 0; margin-top: 10px; padding: 0; line-style: none;}" 
]
if (typeof G == 'undefined') G = {};

G.Hex = function(grid) {
	if (grid) {
		this.grid = grid;
		this.type = this.setGridType(grid.type);
	}

};

G.Hex.constructor = G.Hex;

G.Hex.prototype.setGridType = function(type) {

	if (typeof type === 'undefined') return;

	if (type === G.HexGrid.ODD_R) {
		this.offsetToCube = this.oddRToCube;
		this.cubeToOffset = this.cubeToOddR;
	} else if (type === G.HexGrid.EVEN_R) {
		this.offsetToCube = this.evenRToCube;
		this.cubeToOffset = this.cubeToEvenR;
	} else if (type ===  G.HexGrid.ODD_Q) {
		this.offsetToCube = this.oddQToCube;
		this.cubeToOffset = this.cubeToOddQ;
	}else if (type ===  G.HexGrid.EVEN_Q) {
		this.offsetToCube = this.evenQToCube;
		this.cubeToOffset = this.cubeToEvenQ;
	}

	//in case grid type was added after setting coords
	if (typeof this.q !== 'undefined') {
		this.setAxial(this.q,this.r);
	}else if (typeof this.z !== 'undefined') {
		this.setCube(this.x,this.y,this.z);
	}

	//this.updatePixelPosition();

	return type;

};

G.Hex.prototype.updatePixelPosition = function() {

	if (this.grid && (typeof this.r !== 'undefined')) {

		this.px = -this.grid.pointerOffsetX;
		this.py = -this.grid.pointerOffsetY;

		if (this.grid.pointyTop) {
			this.px += this.grid.hexSize * Math.sqrt(3) * (this.q+this.r/2);
			this.py += this.grid.hexSize * (3/2)*this.r;
		}else {
			this.px += this.grid.hexSize * (3/2) * this.q;
			this.py += this.grid.hexSize * Math.sqrt(3) * (this.r+this.q/2);
		}	


		/*if (!this.corners) {
			this.corners = [];
			for (var i = 0; i < 6; i++) {
				this.corners.push(new Phaser.Point(0,0));
			}
		}

		this.updateCorners();*/
	}

};

G.Hex.prototype.countCorners = function() {

	for (var i = 0; i < 6; i++) {
		result.push(this.countCorner(i));
	}
	return result;

};

G.Hex.prototype.updateCorners = function(i) {

	for (var i = 0; i < 6; i++) {

		var angleDeg = 60 * i + (this.grid.pointyTop ? 30 : 0);
		var angleRad = Math.PI/180*angleDeg;
		this.corners[i].x = this.px + this.grid.hexSize * Math.cos(angleRad);
		this.corners[i].y = this.py + this.grid.hexSize * Math.sin(angleRad);

	}

};

G.Hex.prototype.setAxial = function(q,r) {
	this.q = q;
	this.r = r;
	this.axialToCube();
	if (this.grid) {
		this.cubeToOffset();
		//this.updatePixelPosition();
	}

	return this;
};

G.Hex.prototype.setCube = function(x,y,z) {
	this.x = x;
	this.y = y;
	this.z = z;
	this.cubeToAxial();
	if (this.grid) {
		this.cubeToOffset();
		//this.updatePixelPosition();
	}

	return this;
};

G.Hex.prototype.setOffset = function(col,row) {
	this.col = col;
	this.row = row;
	if (this.grid) {
		this.offsetToCube();
		this.cubeToAxial();
		//this.updatePixelPosition();
	}

	return this;
};

G.Hex.prototype.cubeToAxial = function() {
	this.q = this.x;
	this.r = this.z;
};

//static
G.Hex.add = function(hex1,hex2,out) {

	if (!out) {
		out = new G.Hex(hex1.type);
	}

	return out.copyFrom(hex1).add(hex2);

};

G.Hex.prototype.add = function(hex) {
	this.setCube(this.x+hex.x,this.y+hex.y,this.z+hex.z);
	return this;
};

//static
G.Hex.subtract = function(hex1,hex2,out) {

	if (!out) {
		out = new G.Hex(hex1.type);
	}

	return out.copyFrom(hex1).subtract(hex2);

};

G.Hex.prototype.subtract = function(hex) {
	this.setCube(this.x-hex.x,this.y-hex.y,this.z-hex.z);
	return this;
};


//static
G.Hex.equal = function(hex1,hex2) {

	return (hex1.x-hex2.x == 0
			&& hex1.y-hex2.y == 0
			&& hex1.z-hex2.z == 0)

};

G.Hex.prototype.equalTo = function(hex2) {

	return (this.x-hex2.x == 0
			&& this.y-hex2.y == 0
			&& this.z-hex2.z == 0)

};


//static
G.Hex.scale = function(hex,scale,out) {
	if (!out) {
		out = new G.Hex(hex.type);
	}

	return out.copyFrom(hex).scale(scale);

};

G.Hex.prototype.scale = function(scale) {
	if (scale > 0) {
		this.setCube(this.x*scale,this.y*scale,this.z*scale);
	}
	return this;
};

//static
G.Hex.areNeighbours = function(a,b) {

	return G.Hex.distance(a,b) == 1;

};

G.Hex.isNeighbourOf = function(hex) {

	return G.Hex.distance(this,hex) == 1;

};

//static
G.Hex.distance = function(a,b) {

	return Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y),Math.abs(a.z-b.z));

};

G.Hex.prototype.distanceTo = function(hex) {

	return G.Hex.distance(this,hex);

};

G.Hex.prototype.copyFrom = function(hex) {
	if (hex.type && hex.type !== this.type) this.setGridType(hex.type);
	this.setCube(hex.x,hex.y,hex.y);
	return this;
};

G.Hex.prototype.copyTo = function(hex) {
	if (this.type && this.type !== hex.type) hex.setGridType(hex.type);
	hex.setCube(this.x,this.y,this.z);
	return this;
};

G.Hex.prototype.round = function() {

	var rx = Math.round(this.x);
	var ry = Math.round(this.y);
	var rz = Math.round(this.z);

	var x_diff = Math.abs(rx-this.x);
	var y_diff = Math.abs(ry-this.y);
	var z_diff = Math.abs(rz - this.z);

	if (x_diff > y_diff && x_diff > z_diff) {
		rx = -ry-rz;
	}else if (y_diff > z_diff) {
		ry = -rx-rz;
	}	else {
		rz = -rx-ry;
	}

	this.setCube(rx,ry,rz);

	return this;

};


G.Hex.prototype.axialToCube = function() {
	this.x = this.q;
	this.z = this.r;
	this.y = -this.x-this.z;
};

G.Hex.prototype.cubeToEvenQ = function() {
	this.col = this.x;
	this.row = this.z+(this.x + (this.x%2))/2;
};

G.Hex.prototype.evenQToCube = function() {
	this.x = this.col;
	this.z = this.row-(this.col+(this.col%2))/2;
	this.y = -this.x-this.z;
};

G.Hex.prototype.cubeToOddQ = function() {
	this.col = this.x;
	this.row = this.z + (this.x-(this.x%2))/2;
};

G.Hex.prototype.oddQToCube = function() {
	this.x = this.col;
	this.z = this.row-(this.col-(this.col%2))/2;
	this.y = -this.x-this.z;
};

G.Hex.prototype.cubeToEvenR = function() {
	this.col = this.x+(this.z+(this.z%2))/2;
	this.row = this.z;
};

G.Hex.prototype.evenRToCube = function() {
	this.x = this.col-(this.row+(this.row%2))/2;
	this.z = this.row;
	this.y = -this.x-this.z;
};

G.Hex.prototype.cubeToOddR = function() {
	this.col = this.x+(this.z-(this.z%2))/2;
	this.row = this.z;
};

G.Hex.prototype.oddRToCube = function() {
	this.x = this.col-(this.row-(this.row%2))/2;
	this.z = this.row;
	this.y = -this.x-this.z;
};

G.Hex.prototype.toStringCube = function() {
	return this.x+'x'+this.y+'x'+this.z;
};

G.Hex.prototype.toStringOffset = function() {
	return this.col+'x'+this.row;
};

G.Hex.prototype.toStringAxial = function() {
	return this.q+'x'+this.r;
};
if (typeof G == 'undefined') G = {};

G.HexGrid = function(width,height,config) {

	this.config = config;

	//in case type was name, not number
	var type = config.hexType || 3;
	if (typeof type === 'string') {
		this.type = G.HexGrid.types.indexOf(type);
	}else {
		this.type = type;
	}

	this.pointyTop = type < 2;

	this.hexSize = config.tileSize ? G.l(config.tileSize) : G.l(40);
	this.hexWidth = this.getHexWidth();
	this.hexHeight = this.getHexHeight();

	//for board RT
	this.tileWidth = this.hexWidth;
	this.tileHeight = this.hexHeight;

	this.pointerOffsetX = this.getPointerOffsetX();
	this.pointerOffsetY = this.getPointerOffsetY();
	
	this.grid = new G.GridArray(width,height);
	this.grid.loop(function(v,col,row,data) {
		data[col][row] = new G.Hex(this).setOffset(col,row);
	},this);

	this.width = this.grid.width;
	this.height = this.grid.height;

	this._tmpHex = new G.Hex(this);
	this._tmpHex2 = new G.Hex(this);

	this.directions = [
		new G.Hex().setCube(+1,-1,0),
		new G.Hex().setCube(+1,0,-1),
		new G.Hex().setCube(0,+1,-1),
		new G.Hex().setCube(-1,+1,0),
		new G.Hex().setCube(-1,0,+1),
		new G.Hex().setCube(0,-1,+1)
	];

	this.directionsLabels = {
		"RD": this.directions[0],
		"RU": this.directions[1],
		"U" : this.directions[2],
		"LU" : this.directions[3],
		"LD" : this.directions[4],
		"D" : this.directions[5]
	};

};

G.HexGrid.types = ['oddR','evenR','oddQ','evenQ'];
G.HexGrid.ODD_R = 0;
G.HexGrid.EVEN_R = 1;
G.HexGrid.ODD_Q = 2;
G.HexGrid.EVEN_Q = 3;

G.HexGrid.prototype.getPointerOffsetX = function() {
		//change pixel coord depend on type

	return this.type == G.HexGrid.EVEN_R ? -this.hexWidth : -this.hexWidth*0.5;

	if (this.type == G.HexGrid.ODD_R) {
		x -= this.hexWidth*0.5;
	}else if (this.type == G.HexGrid.EVEN_R) {
		x -= this.hexWidth;
	}else if (this.type == G.HexGrid.ODD_Q) {
		x -= this.hexWidth*0.5;
	}else if (this.type == G.HexGrid.EVEN_Q) {
		x -= this.hexWidth*0.5;
	}

};

G.HexGrid.prototype.getPointerOffsetY = function() {
		//change pixel coord depend on type
	return this.type == G.HexGrid.EVEN_Q ? -this.hexHeight : -this.hexHeight*0.5;

}

G.HexGrid.prototype.getHexWidth = function() {
	if (this.pointyTop) {
		return Math.sqrt(3)/2 * (this.hexSize*2);
	}else {
		return this.hexSize*2;
	}	
};

G.HexGrid.prototype.getHexHeight = function() {
	if (this.pointyTop) {
		return this.hexSize*2;
	}else {
		return Math.sqrt(3)/2*(this.hexSize*2);
	}
};

G.HexGrid.prototype.getPxPosition = function(x,y,out) {

	if (typeof out === 'undefined') {
		out = new Phaser.Point(0,0);
	}

	this._tmpHex.setOffset(x,y);

	out.x = -this.pointerOffsetX;
	out.y = -this.pointerOffsetY;

	if (this.pointyTop) {
		out.x += this.hexSize * Math.sqrt(3) * (this._tmpHex.q+this._tmpHex.r/2);
		out.y += this.hexSize * (3/2)*this._tmpHex.r;
	}else {
		out.x += this.hexSize * (3/2) * this._tmpHex.q;
		out.y += this.hexSize * Math.sqrt(3) * (this._tmpHex.r+this._tmpHex.q/2);
	}	

	out.x = Math.floor(out.x);
	out.y = Math.floor(out.y);

	return out;

};

G.HexGrid.prototype.pixelToCoord = function(x,y,startPoint,scalePoint,out) {

	var q, r;
	
	x = ((x-startPoint.x)*(1/scalePoint.x))+this.pointerOffsetX;
	y = ((y-startPoint.y)*(1/scalePoint.y))+this.pointerOffsetY;

	
	//axial coordinates
	if (this.pointyTop) {
		q = (x * Math.sqrt(3)/3 - y / 3) / this.hexSize;
    	r = y * 2/3 / this.hexSize;
	}else {
		q = x * 2/3 / this.hexSize;
    	r = (-x / 3 + Math.sqrt(3)/3 * y) / this.hexSize;
	}


	this.hlHex = new G.Hex(this).setAxial(q,r).round();
	if (out) {
		out.x = this.hlHex.col;
		out.y = this.hlHex.row;
		return out;
	}else {

		return new Phaser.Point(this.hlHex.col,this.hlHex.row);
			
	}

};

G.HexGrid.prototype.dbgDrawGrid = function(gfx) {

	gfx.clear();

	gfx.beginFill(0x333333,1);
	gfx.lineStyle(2,0x000000,1);

	this.grid.loop(function(hex,x,y) {

		if (this.hlHex && this.hlHex.col == x && this.hlHex.row == y) {
			gfx.beginFill(0x333333,1);
		}else {
			gfx.beginFill(0x333333,0.5);
		}

		if (hex.hl) {
			gfx.beginFill(0xff0000,0.5);
		}

		gfx.drawPolygon(hex.corners);

	},this);

};

G.HexGrid.prototype.getNeighbourCoords = function(x,y,direction,out) {

	var dir;

	if (typeof out === 'undefined') {
		out = {}
	}

	if (typeof direction === 'string') {
		dir = this.directionsLabels[direction];
	}else {

		direction = direction%this.directions.length;
		if (direction < 0) direction = this.directions.length+direction;
 
		dir = this.directions[direction];
	}
	
	this._tmpHex.setOffset(x,y).add(dir);

	out.x = this._tmpHex.col;
	out.y = this._tmpHex.row;
	return out;
	
};



G.HexGrid.prototype.areNeighbours = function(x,y,x2,y2) {

	this._tmpHex.setOffset(x,y);
	this._tmpHex2.setOffset(x2,y2);
	return this._tmpHex.isNeighbourOf(this._tmpHex2);

};

G.HexGrid.prototype.getRing = function(x,y,radius) {

	var result = [];
	if (radius < 0) return result;
	var scaledDirection = new G.Hex(this).copyFrom(this.directions[3]).scale(radius);
	var cube = new G.Hex(this).setOffset(x,y).add(scaledDirection);
	
	for (var i = 0; i < 6; i++) {
		for (var j = 0; j < radius; j++) {

			var val = this.getGridValOffset(cube.col,cube.row);
			if (val) result.push(val);
			cube.add(this.directions[i]);
		}
	}

	result.forEach(function(h){h.hl=true;});

	return result;

};


//for possible movement direction check
G.HexGrid.prototype.getDirection = function(x,y,x2,y2) {

	this._tmpHex.setOffset(x2,y2).subtract(this._tmpHex2.setOffset(x,y));

	for (dir in this.directionsLabels) {
		if (G.Hex.equal(this.directionsLabels[dir],this._tmpHex)) {
			return dir;
		}
	}	

	return false;

};

G.HexGrid.prototype.isMoveValid = function(x,y,x2,y2){

	return this.getDirection(x,y,x2,y2);

};

G.HexGrid.prototype.getGridValAxial = function(q,r) {
	this._tmpHex.setAxial(q,r);
	return this.grid.get(this._tmpHex.col,this._tmpHex.row);
};

G.HexGrid.prototype.getGridValOffset = function(col,row) {
	return this.grid.get(col,row);
};

G.HexGrid.prototype.getGridVal = G.HexGrid.prototype.getGridValOffset;

G.HexGrid.prototype.getGridValCube = function(x,y,z) {
	this._tmpHex.setCube(x,y,z);
	return this.grid.get(this._tmpHex.col,this._tmpHex.row);
};
if (typeof G == 'undefined') G = {};

G.Square = function(grid,x,y) {
	this.grid = grid;
	this.x = x;
	this.y = y;
	this.updatePixelPosition();
};

G.Square.constructor = G.Triangle;

G.Square.prototype.updatePixelPosition = function() {

		this.px = this.x*this.grid.squareWidth+(this.grid.squareWidth*0.5);
		this.py = this.y*this.grid.squareWidth+(this.grid.squareWidth*0.5);

};

G.Square.prototype.setTo = function(x,y) {

	this.x = x;
	this.y = y;
	this.getDirection();
	this.updatePixelPosition();

};

//static
G.Square.add = function(a,b,out) {

	if (!out) {
		out = new G.Triangle(a.grid,a.x,a.y);
	}

	return out.add(b);

};

G.Square.prototype.add = function(b) {
	this.setTo(this.x+b.x,this.y+b.y);
	return this;
};

//static
G.Square.areNeighbours = function(a,b) {
	return a.isNeighbourOf(b);
};

G.Square.isNeighbourOf = function(b) {

	var diff = Math.max(Math.abs(this.x-b.x),Math.abs(this.y-b.y));
	return diff == 1;

};

G.Square.prototype.copyFrom = function(b) {
	this.setTo(b.x,b.y);
	return this;
};

G.Square.prototype.copyTo = function(b) {
	b.setTo(this.x,this.y);
	return this;
};


G.Square.prototype.toString = function() {
	return this.x+'x'+this.y+' dir: '+this.dir;
};
if (typeof G == 'undefined') G = {};

G.SquareGrid = function(width,height,config) {

	this.config = config;

	this.squareWidth = config.tileSize ? G.l(config.tileSize) : G.l(76);
	this.squareHeight = config.tileSize ? G.l(config.tileSize) : G.l(76); 
	this.pointerOffsetX = 0;
	this.pointerOffsetY = 0;

	this.tilePadding = config.tilePadding || 0;
	//for boardRT
	this.tileWidth = config.tileSize;
	this.tileHeight = config.tileSize;

	this.grid = new G.GridArray(width,height);
	this.grid.loop(function(v,col,row,data) {
		data[col][row] = new G.Square(this,col,row);
	},this);

	this.width = this.grid.width;
	this.height = this.grid.height;

	this.directions = [
		[1,0],
		[1,-1],
		[0,-1],
		[-1,-1],
		[-1,0],
		[-1,1],
		[0,1],
		[1,1]
	];

	this.directionsLabels = {
		"R": this.directions[0],
		"RU": this.directions[1],
		"U" : this.directions[2],
		"LU" : this.directions[3],
		"L" : this.directions[4],
		"LD" : this.directions[5],
		"D" : this.directions[6],
		"RD" : this.directions[7]
	};

};

G.SquareGrid.prototype.pixelToCoord = function(x,y,startPoint,scalePoint,out) {
	
	x = (x+this.pointerOffsetX-startPoint.x)*(1/scalePoint.x);
	y = (y+this.pointerOffsetY-startPoint.y)*(1/scalePoint.y);

	var cellX;
	var cellY;

	if (this.tilePadding > 0) {

		var cellXNF = x/(this.squareWidth+this.tilePadding);
		var cellYNF = y/(this.squareHeight+this.tilePadding);

		//check if pointer is on square, not padding
		if (cellXNF <= Math.floor(cellXNF)+(this.squareWidth/(this.squareWidth+this.tilePadding))
			&& cellYNF <= Math.floor(cellYNF)+(this.squareHeight/(this.squareHeight+this.tilePadding))) {

			cellX = Math.floor(cellXNF);
			cellY = Math.floor(cellYNF);

			//it is on padding. return ridiculous values
		}else {	

			cellX = -999999;
			cellY = -999999;

		}

		
	}else {

		cellX = Math.floor(x/this.squareWidth);
		cellY = Math.floor(y/this.squareHeight);

	}

	if (out) {

		out.x = cellX;
		out.y = cellY;

	}else {

		return new Phaser.Point(cellX,cellY);

	}

};

G.SquareGrid.prototype.getPxPosition = function(x,y,out) {

	if (typeof out === 'undefined') {
		out = new Phaser.Point(0,0);
	}
	out.x = Math.floor(x*(this.squareWidth+this.tilePadding)+(this.squareWidth*0.5));
	out.y = Math.floor(y*(this.squareWidth+this.tilePadding)+(this.squareWidth*0.5));

	return out;

};


G.SquareGrid.prototype.dbgDrawGrid = function(gfx) {

	gfx.clear();

	gfx.beginFill(0x333333,1);
	gfx.lineStyle(2,0x000000,1);

	this.grid.loop(function(tr,x,y) {
		
		gfx.beginFill(0x333333,0.5);

		gfx.drawRect(x*(this.squareWidth+this.tilePadding),y*(this.squareHeight+this.tilePadding),this.squareWidth,this.squareHeight);

	},this);

};

G.SquareGrid.prototype.getNeighbourCoords = function(x,y,direction,out) {

	var dir;

	if (typeof out === 'undefined') {
		out = {}
	}

	if (typeof direction === 'string') {
		dir = this.directionsLabels[direction];
	}else {
		dir = this.directions[direction];
	}


	out.x = x+dir[0];
	out.y = y+dir[1];
	return out;
	

};

//for possible movement direction check
G.SquareGrid.prototype.getDirection = function(x,y,x2,y2) {

	for (dir in this.directionsLabels) {
		if (this.directionsLabels[dir][0] == x2-x
			&& this.directionsLabels[dir][1] == y2-y){
			return dir;
		}
	}

	return false;

};

G.SquareGrid.prototype.isMoveValid = function(x,y,x2,y2){

	var dir = this.getDirection(x,y,x2,y2);

	if (dir === 'U' || dir === 'D' || dir === 'L' || dir === 'R') {
		return true;
	}else {
		return false;
	}

};

G.SquareGrid.prototype.areNeighbours = function(x,y,x2,y2) {

	return Math.max(Math.abs(x-x2),Math.abs(y-y2)) == 1;

};

G.SquareGrid.prototype.getGridVal = function(col,row) {
	return this.grid.get(col,row);
};



G.SquareGrid.prototype.getRing = function(x,y,radius) {

	radius = radius || 1;

	var result = [];
	var point = {x:x,y:y}

	for (var radiusOffset = 0; radiusOffset<radius; radiusOffset++) {
		this.getNeighbourCoords(point.x,point.y,'LD',point);
	}

	var directions = ['R','U','L','D'];

	for (var dirIndex = 0; dirIndex < 4; dirIndex++) {
		var dir = directions[dirIndex];
		for (var i = 0; i < radius+1; i++) {
			this.getNeighbourCoords(point.x,point.y,dir,point);
			result.push({x:point.x,y:point.y});
		}
	}

	return result;

};
if (typeof G == 'undefined') G = {};

G.Triangle = function(grid,x,y) {
	this.grid = grid;
	this.x = x;
	this.y = y;
	this.updatePixelPosition();
};

G.Triangle.constructor = G.Triangle;

G.Triangle.prototype.updatePixelPosition = function() {

		this.px = this.x*this.grid.triangleWidth;
		this.py = this.y*(this.grid.triangleHeight*0.5);

		if (!this.corners) {
			this.corners = [];
			for (var i = 0; i < 3; i++) {
				this.corners.push(new Phaser.Point(0,0));
			}
		}

		this.dir = this.getDirection();
		this.updateCorners();

};

G.Triangle.prototype.setTo = function(x,y) {

	this.x = x;
	this.y = y;
	this.getDirection();
	this.updatePixelPosition();

};

G.Triangle.prototype.getDirection = function() {

	var result = 0;

	var colMod = this.x%2;
	var rowMod = this.y%2;

	var sumMod = (colMod+rowMod)%2;

	return (this.grid.firstDir+sumMod)%2;

};

G.Triangle.prototype.updateCorners = function(i) {

	if (this.dir == 1) {
		this.corners[0].x = this.px;
		this.corners[0].y = this.py;
		this.corners[1].x = this.px+this.grid.triangleWidth;
		this.corners[1].y = this.py+(this.grid.triangleHeight*0.5);
		this.corners[2].x = this.px;
		this.corners[2].y = this.py+this.grid.triangleHeight;
	}else {
		this.corners[0].x = this.px;
		this.corners[0].y = this.py+this.grid.triangleHeight*0.5;
		this.corners[1].x = this.px+this.grid.triangleWidth;
		this.corners[1].y = this.py;
		this.corners[2].x = this.px+this.grid.triangleWidth;
		this.corners[2].y = this.py+this.grid.triangleHeight;
	}

};


//static
G.Triangle.add = function(a,b,out) {

	if (!out) {
		out = new G.Triangle(a.grid,a.x,a.y);
	}

	return out.add(b);

};

G.Triangle.prototype.add = function(b) {
	this.setTo(this.x+b.x,this.y+b.y);
	return this;
};

//static
G.Triangle.areNeighbours = function(a,b) {
	return a.isNeighbourOf(b);
};

G.Triangle.isNeighbourOf = function(b) {

	var diff = Math.max(Math.abs(this.x-b.x),Math.abs(this.y-b.y));
	return diff == 1;

};

G.Triangle.prototype.copyFrom = function(b) {
	this.setTo(b.x,b.y);
	return this;
};

G.Triangle.prototype.copyTo = function(b) {
	b.setTo(this.x,this.y);
	return this;
};


G.Triangle.prototype.toString = function() {
	return this.x+'x'+this.y+' dir: '+this.dir;
};
if (typeof G == 'undefined') G = {};

G.TriangleGrid = function(width,height,config) {

	this.config = config;

	//triangleWidth,triangleHeight,firstDir,
	this.triangleWidth = config.triangleWidth || 106;
	this.triangleHeight = config.triangleHeight || 122;
	this.firstDir = config.firstDir || 0;
	this.pointerOffsetX = 0;
	this.pointerOffsetY = 0;
	//for boardRT
	this.tileWidth = this.triangleWidth;
	this.tileHeight = this.triangleHeight;

	this.gemSideOffset = config.gemSideOffset || 0.3;

	this.grid = new G.GridArray(width,height);
	this.grid.loop(function(v,col,row,data) {
		data[col][row] = new G.Triangle(this,col,row);
	},this);

	this.width = width;
	this.height = height;


	this.directions = [
		"RD",
		"RU",
		"U",
		"LU",
		"LD",
		"D"
	];

	this.directionsLabels = {
		"L": [-1,0],
		"R": [1,0],
		"U": [0,-1],
		"D": [0,1]
	};

};

G.TriangleGrid.prototype.getPxPosition = function(x,y,out) {

	if (typeof out === 'undefined') {
		out = new Phaser.Point(0,0);
	}

	var right = this.isPointingRight(x,y);

	var px = x*this.triangleWidth+(this.triangleWidth*(right?this.gemSideOffset:1-this.gemSideOffset));
	var py = y*this.triangleHeight*0.5+(this.triangleHeight*0.5);

	out.x = px;
	out.y = py;

	return out;

};

G.TriangleGrid.prototype.pixelToCoord = function(x,y,startPoint,scalePoint,out) {
	
	x = (x+this.pointerOffsetX-startPoint.x)*(1/scalePoint.x);
	y = (y+this.pointerOffsetY-startPoint.y)*(1/scalePoint.y);
	
	//cellX is certain from that point
	var col = Math.floor(x/this.triangleWidth);
	var row = Math.floor(y/(this.triangleHeight*0.5));

	this.__rawCol = col; 
	this.__rawRow = row;

	var xOffset = (x-(col*this.triangleWidth))/this.triangleWidth;
	var yOffset = (y-(row*this.triangleHeight*0.5))/(this.triangleHeight*0.5);

	if (this.__rawDir = this.isPointingRight(col,row) == 1) {
		if (xOffset > yOffset) {
			row--;
		}
	}else {
		if (xOffset < (1-yOffset)) {
			row--;
		}
	}

	if (out) {
		out.x = col;
		out.y = row;
	}else {
		return new Phaser.Point(col,row);
	}

};

G.TriangleGrid.prototype.isPointingRight = function(x,y) {

	var result = 0;

	var colMod = x%2;
	var rowMod = y%2;

	var sumMod = (colMod+rowMod)%2;

	return (this.firstDir+sumMod)%2;

};


G.TriangleGrid.prototype.dbgDrawGrid = function(gfx) {

	gfx.clear();

	gfx.beginFill(0x333333,1);
	gfx.lineStyle(2,0x000000,1);

	this.grid.loop(function(tr,x,y) {

		if (this.hlTriangle && this.hlTriangle.x == x && this.hlTriangle.y == y) {
			gfx.beginFill(0x333333,1);
		}else {
			gfx.beginFill(0x333333,0.5);
		}

		gfx.drawPolygon(tr.corners);

	},this);

};

G.TriangleGrid.prototype.getNeighbourCoords = function(x,y,dir,out) {

	if (typeof out == 'undefined') out = {};

	var right = this.isPointingRight(x,y);

	if (dir == 'U' || (right && dir == 'RU') || (!right && dir == 'LU')){
		out.x = x;
		out.y = y-1;
		return out;
	}

	if (dir == 'D' || (right & dir == 'RD') || (!right & dir == 'LD')){
		out.x = x;
		out.y = y+1;
		return out;
	}

	if (dir == 'L' || (right && (dir == 'LU' || dir == 'LD'))){
		out.x = x-1;
		out.y = y;
		return out;
	}

	if (dir == 'R' || (!right && (dir == 'RD' || dir == 'RU'))){
		out.x = x+1;
		out.y = y;
		return out;
	}

};

G.TriangleGrid.prototype.getDirection = function(x,y,x2,y2){

	for (dir in this.directionsLabels) {
		if (this.directionsLabels[dir][0] == x2-x
			&& this.directionsLabels[dir][1] == y2-y){
			return dir;
		}
	}

	return false;


};

G.TriangleGrid.prototype.getGridVal = function(col,row) {
	return this.grid.get(col,row);
};

G.TriangleGrid.prototype.getRing = function(x,y,radius){

	console.warn('getRing to be implemented');

};

G.TriangleGrid.prototype.isMoveValid = function(x,y,x2,y2){

	var right = this.isPointingRight(x,y);
	var dir = this.getDirection(x,y,x2,y2);

	if (!dir) return false;

	if ((right && dir == 'R') || (!right && dir == 'L')) {
		return false;
	}

	return dir;

};
if (typeof G == 'undefined') G = {};

G.ExtLoader = function(){

    Phaser.Loader.call(this,game);
    game.state.onStateChange.add(this.reset,this);
    this.imagesToRemoveOnStateChange = [];
    this.loadedUrls = {}; 

};

G.ExtLoader.prototype = Object.create(Phaser.Loader.prototype);

G.ExtLoader.prototype.reset = function(hard, clearEvents){

    this.imagesToRemoveOnStateChange.forEach(function(key) {
      this.cache.removeImage(key);
  },this);
  this.imagesToRemoveOnStateChange = [];

    Phaser.Loader.prototype.reset.call(this,hard,clearEvents);

};

G.ExtLoader.prototype.addToFileList = function(type, key, url, properties, overwrite, extension) {

    if (overwrite === undefined) {
        overwrite = false;
    }

    if (key === undefined || key === '') {
        console.warn("Phaser.Loader: Invalid or no key given of type " + type);
        return this;
    }

    if (url === undefined || url === null) {
        if (extension) {
            url = key + extension;
        } else {
            console.warn("Phaser.Loader: No URL given for file type: " + type + " key: " + key);
            return this;
        }
    }

    var file = {
        type: type,
        key: key,
        path: this.path,
        url: url,
        syncPoint: this._withSyncPointDepth > 0,
        data: null,
        loading: false,
        loaded: false,
        error: false
    };

    if (properties) {
        for (var prop in properties) {
            file[prop] = properties[prop];
        }
    }

    var fileIndex = this.getAssetIndex(type, key);

    if (overwrite && fileIndex > -1) {
        var currentFile = this._fileList[fileIndex];

        if (!currentFile.loading && !currentFile.loaded) {
            this._fileList[fileIndex] = file;
        } else {
            this._fileList.push(file);
            this._totalFileCount++;
        }
    } else if (fileIndex === -1) {
        this._fileList.push(file);
        this._totalFileCount++;
    }

    this.loadFile(this._fileList.shift());

    return this;

}

G.ExtLoader.prototype.asyncComplete = function(file, errorMessage) {

    if (errorMessage === undefined) {
        errorMessage = '';
    }

    file.loaded = true;
    file.error = !! errorMessage;

    if (errorMessage) {
        file.errorMessage = errorMessage;

        console.warn('Phaser.Loader - ' + file.type + '[' + file.key + ']' + ': ' + errorMessage);
        // debugger;
    }

    //this.processLoadQueue();

}

G.ExtLoader.prototype.fileComplete =  function(file, xhr) {

  var loadNext = true;



  switch (file.type) {
      case 'packfile':

          // Pack data must never be false-ish after it is fetched without error
          var data = JSON.parse(xhr.responseText);
          file.data = data || {};
          break;

      case 'image':

          this.cache.addImage(file.key, file.url, file.data);
          break;

      case 'spritesheet':

          this.cache.addSpriteSheet(file.key, file.url, file.data, file.frameWidth, file.frameHeight, file.frameMax, file.margin, file.spacing);
          break;

      case 'textureatlas':

          if (file.atlasURL == null) {
              this.cache.addTextureAtlas(file.key, file.url, file.data, file.atlasData, file.format);
          } else {
              //  Load the JSON or XML before carrying on with the next file
              loadNext = false;

              if (file.format == Phaser.Loader.TEXTURE_ATLAS_JSON_ARRAY || file.format == Phaser.Loader.TEXTURE_ATLAS_JSON_HASH || file.format == Phaser.Loader.TEXTURE_ATLAS_JSON_PYXEL) {
                  this.xhrLoad(file, this.transformUrl(file.atlasURL, file), 'text', this.jsonLoadComplete);
              } else if (file.format == Phaser.Loader.TEXTURE_ATLAS_XML_STARLING) {
                  this.xhrLoad(file, this.transformUrl(file.atlasURL, file), 'text', this.xmlLoadComplete);
              } else {
                  throw new Error("Phaser.Loader. Invalid Texture Atlas format: " + file.format);
              }
          }
          break;

      case 'bitmapfont':

          if (!file.atlasURL) {
              this.cache.addBitmapFont(file.key, file.url, file.data, file.atlasData, file.atlasType, file.xSpacing, file.ySpacing);
          } else {
              //  Load the XML before carrying on with the next file
              loadNext = false;
              this.xhrLoad(file, this.transformUrl(file.atlasURL, file), 'text', function(file, xhr) {
                  var json;

                  try {
                      // Try to parse as JSON, if it fails, then it's hopefully XML
                      json = JSON.parse(xhr.responseText);
                  } catch (e) {}

                  if ( !! json) {
                      file.atlasType = 'json';
                      this.jsonLoadComplete(file, xhr);
                  } else {
                      file.atlasType = 'xml';
                      this.xmlLoadComplete(file, xhr);
                  }
              });
          }
          break;

      case 'video':

          if (file.asBlob) {
              try {
                  file.data = xhr.response;
              } catch (e) {
                  throw new Error("Phaser.Loader. Unable to parse video file as Blob: " + file.key);
              }
          }

          this.cache.addVideo(file.key, file.url, file.data, file.asBlob);
          break;

      case 'audio':

          if (this.game.sound.usingWebAudio) {
              file.data = xhr.response;

              this.cache.addSound(file.key, file.url, file.data, true, false);

              if (file.autoDecode) {
                  this.game.sound.decode(file.key);
              }
          } else {
              this.cache.addSound(file.key, file.url, file.data, false, true);
          }
          break;

      case 'text':
          file.data = xhr.responseText;
          this.cache.addText(file.key, file.url, file.data);
          break;

      case 'shader':
          file.data = xhr.responseText;
          this.cache.addShader(file.key, file.url, file.data);
          break;

      case 'physics':
          var data = JSON.parse(xhr.responseText);
          this.cache.addPhysicsData(file.key, file.url, data, file.format);
          break;

      case 'script':
          file.data = document.createElement('script');
          file.data.language = 'javascript';
          file.data.type = 'text/javascript';
          file.data.defer = false;
          file.data.text = xhr.responseText;
          document.head.appendChild(file.data);
          if (file.callback) {
              file.data = file.callback.call(file.callbackContext, file.key, xhr.responseText);
          }
          break;

      case 'binary':
          if (file.callback) {
              file.data = file.callback.call(file.callbackContext, file.key, xhr.response);
          } else {
              file.data = xhr.response;
          }

          this.cache.addBinary(file.key, file.data);

          break;
  }

  this.onFileComplete.dispatch(0, file.key, !file.error); 

}
/*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js */
var saveAs=saveAs||function(e){"use strict";if(typeof e==="undefined"||typeof navigator!=="undefined"&&/MSIE [1-9]\./.test(navigator.userAgent)){return}var t=e.document,n=function(){return e.URL||e.webkitURL||e},r=t.createElementNS("http://www.w3.org/1999/xhtml","a"),o="download"in r,a=function(e){var t=new MouseEvent("click");e.dispatchEvent(t)},i=/constructor/i.test(e.HTMLElement)||e.safari,f=/CriOS\/[\d]+/.test(navigator.userAgent),u=function(t){(e.setImmediate||e.setTimeout)(function(){throw t},0)},s="application/octet-stream",d=1e3*40,c=function(e){var t=function(){if(typeof e==="string"){n().revokeObjectURL(e)}else{e.remove()}};setTimeout(t,d)},l=function(e,t,n){t=[].concat(t);var r=t.length;while(r--){var o=e["on"+t[r]];if(typeof o==="function"){try{o.call(e,n||e)}catch(a){u(a)}}}},p=function(e){if(/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(e.type)){return new Blob([String.fromCharCode(65279),e],{type:e.type})}return e},v=function(t,u,d){if(!d){t=p(t)}var v=this,w=t.type,m=w===s,y,h=function(){l(v,"writestart progress write writeend".split(" "))},S=function(){if((f||m&&i)&&e.FileReader){var r=new FileReader;r.onloadend=function(){var t=f?r.result:r.result.replace(/^data:[^;]*;/,"data:attachment/file;");var n=e.open(t,"_blank");if(!n)e.location.href=t;t=undefined;v.readyState=v.DONE;h()};r.readAsDataURL(t);v.readyState=v.INIT;return}if(!y){y=n().createObjectURL(t)}if(m){e.location.href=y}else{var o=e.open(y,"_blank");if(!o){e.location.href=y}}v.readyState=v.DONE;h();c(y)};v.readyState=v.INIT;if(o){y=n().createObjectURL(t);setTimeout(function(){r.href=y;r.download=u;a(r);h();c(y);v.readyState=v.DONE});return}S()},w=v.prototype,m=function(e,t,n){return new v(e,t||e.name||"download",n)};if(typeof navigator!=="undefined"&&navigator.msSaveOrOpenBlob){return function(e,t,n){t=t||e.name||"download";if(!n){e=p(e)}return navigator.msSaveOrOpenBlob(e,t)}}w.abort=function(){};w.readyState=w.INIT=0;w.WRITING=1;w.DONE=2;w.error=w.onwritestart=w.onprogress=w.onwrite=w.onabort=w.onerror=w.onwriteend=null;return m}(typeof self!=="undefined"&&self||typeof window!=="undefined"&&window||this.content);if(typeof module!=="undefined"&&module.exports){module.exports.saveAs=saveAs}else if(typeof define!=="undefined"&&define!==null&&define.amd!==null){define("FileSaver.js",function(){return saveAs})}
if (typeof G == 'undefined') G = {};


G.Button = function (x, y, sprite, callback, context) {
	Phaser.Button.call(this, game, G.l(x), G.l(y), null);

	this.state = game.state.getCurrentState();

	G.changeTexture(this, sprite);
	this.anchor.setTo(0.5);

	this.sfx = G.sfx.pop;

	this.active = true;

	this.onClick = new Phaser.Signal();
	if (callback) {
		this.onClick.add(callback, context || this);
	}

	if (game.device.desktop) {
		this.onInputUp.add(this.click, this);
	} else {
		this.onInputUp.add(this.click_Mobile, this);
	}

	this.terms = [];

	this.IMMEDIATE = false;

	this.scaleOnClick = true;

	this.targetAlphaTermsNotFulfilled = 0.5;
	this.targetAlpha = 1;

	this.refractorPeriod = 400;
	this.scaleChange = 0.1;
	this.pulsing = false;
}

G.Button.prototype = Object.create(Phaser.Button.prototype);
G.Button.constructor = G.Button;

G.Button.prototype.update = function () {

	if (this.checkTerms()) {
		this.targetAlpha = 1;
	} else {
		this.targetAlpha = this.targetAlphaTermsNotFulfilled;
	}

	this.alpha = G.lerp(this.alpha, this.targetAlpha, 0.2, 0.05);
	this.updateChildren();
};

G.Button.prototype.pulse = function (maxScale) {
	this.pulsing = true;
	this.pulsingTween = game.add.tween(this.scale).to({ x: maxScale || 1.1, y: maxScale || 1.1 }, 500, Phaser.Easing.Sinusoidal.InOut, true, 0, -1, true);
};

G.Button.prototype.stopPulse = function (maxScale) {
	if (this.pulsingTween) this.pulsingTween.stop();
	this.scale.setTo(maxScale || 1);
	this.pulsing = false;
};


G.Button.prototype.click = function () {
	if (!this.active) return;

	if (!this.checkTerms()) return;

	this.active = false;
	this.onClick.dispatch();

	if (this.sfx) this.sfx.play();

	var orgScaleX = this.scale.x;
	var orgScaleY = this.scale.y;

	if (this.IMMEDIATE) {
		this.active = true;
	} else {
		if (this.pulsing || !this.scaleOnClick) {
			game.time.events.add(this.refractorPeriod, function () { this.active = true }, this);
		} else {
			game.add.tween(this.scale).to({ x: orgScaleX + this.scaleChange, y: orgScaleY + this.scaleChange }, Math.floor(this.refractorPeriod * 0.5), Phaser.Easing.Quadratic.Out, true).onComplete.add(function () {
				game.add.tween(this.scale).to({ x: orgScaleX, y: orgScaleY }, Math.floor(this.refractorPeriod * 0.5), Phaser.Easing.Quadratic.Out, true).onComplete.add(function () {
					this.active = true;
				}, this)
			}, this)
		}
	}
};

G.Button.prototype.click_Mobile = function () {

	const tempTimeOut = setTimeout(() => {
		if (!this.active) return;

		if (!this.checkTerms()) return;

		this.active = false;
		this.onClick.dispatch();

		if (this.sfx) this.sfx.play();

		var orgScaleX = this.scale.x;
		var orgScaleY = this.scale.y;

		if (this.IMMEDIATE) {
			this.active = true;
		} else {
			if (this.pulsing || !this.scaleOnClick) {
				game.time.events.add(this.refractorPeriod, function () { this.active = true }, this);
			} else {
				game.add.tween(this.scale).to({ x: orgScaleX + this.scaleChange, y: orgScaleY + this.scaleChange }, Math.floor(this.refractorPeriod * 0.5), Phaser.Easing.Quadratic.Out, true).onComplete.add(function () {
					game.add.tween(this.scale).to({ x: orgScaleX, y: orgScaleY }, Math.floor(this.refractorPeriod * 0.5), Phaser.Easing.Quadratic.Out, true).onComplete.add(function () {
						this.active = true;
					}, this)
				}, this)
			}
		}
		clearTimeout(tempTimeOut);
	}, 50);
};

G.Button.prototype.checkTerms = function () {

	for (var i = 0; i < this.terms.length; i++) {
		if (!this.terms[i][0].call(this.terms[i][1])) {
			return false;
		}
	}
	return true;
};

G.Button.prototype.addTerm = function (callback, context) {
	this.terms.push([callback, context]);
}

G.Button.prototype.addImageLabel = function (image) {
	this.label = game.make.image(0, 0, 'ssheet', image);
	this.label.anchor.setTo(0.5);
	this.addChild(this.label);
};

G.Button.prototype.addTextLabel = function (font, text, size) {
	var multi = 1 / G.Loader.currentConfigMulti;
	this.label = new G.OneLineText(-5, -12, font, text, size || Math.floor(this.height * multi * 0.7), this.width * multi * 0.9, 0.5, 0.5);
	this.addChild(this.label);
};

G.Button.prototype.addTextLabelonMenuButton = function (font, text, size) {
	var multi = 1 / G.Loader.currentConfigMulti;
	this.label = new G.OneLineText(-5, -12, font, text, size || Math.floor(this.height * multi * 0.7), this.width * multi * 0.9, 0.5, 0.5);
	this.label.scale.x = 0.9;
	this.addChild(this.label);
};

G.Button.prototype.addTextLabelGameOver = function (font, text, size) {
	var multi = 1 / G.Loader.currentConfigMulti;
	this.label = new G.OneLineText(0, -15, font, text, size || Math.floor(this.height * multi * 0.7), this.width * multi * 0.9, 0.5, 0.5);
	this.addChild(this.label);
};

G.Button.prototype.addTextLabelMultiline = function (font, text) {
	var multi = 1 / G.Loader.currentConfigMulti;
	this.label = new G.MultiLineText(0, 0, font, text, Math.floor(this.height * multi * 0.5), this.width * multi * 0.8, this.height * multi * 0.7, 'center', 0.5, 0.5);
	this.addChild(this.label);
};

G.Button.prototype.addGTextLabel = function (text, style) {
	this.label = new G.Text(0, 0, text, style, 0.5, this.width * 0.9, this.height * 0.9, true, 'center');
	this.addChild(this.label);
};

G.Button.prototype.stopTweens = function () {
	G.stopTweens(this);
};

G.Button.prototype.changeTexture = function (image) {
	G.changeTexture(this, image);
};

G.Button.prototype.add = function (obj) {
	return this.addChild(obj)
};

G.Button.prototype.updateChildren = function () {
	for (var i = this.children.length; i--;) {
		this.children[i].update();
	}
};

if (typeof G == 'undefined') G = {};


G.FrameAnimation = function(x,y,frameName,frameRate,autoPlay) {

	Phaser.Image.call(this,game,G.l(x),G.l(y));

	this.anchor.setTo(0.5);

	this.frameNamePrefix = frameName;
	this.animFramesLen = this.getAnimationLength(this.frameNamePrefix);

	this.timerEvery = frameRate ? (60/frameRate) : 1;
	this.animDir = 1;

	G.changeTexture(this,this.frameNamePrefix+'_0');

	this.currentTimer = 0;
	this.currentIndex = 0;

	this.onFinish = new Phaser.Signal();

	this.active = autoPlay || false;
	

};

G.FrameAnimation.prototype = Object.create(Phaser.Image.prototype);

G.FrameAnimation.prototype.play = function(loop,bounce,startFrame) {

	this.currentTimer = 0;
	this.currentIndex = startFrame || 0;
	this.active = true;
	this.loop = loop-1 || 0;
	this.animDir = 1;
	this.bounce = bounce || false;
	G.changeTexture(this,this.frameNamePrefix+'_'+this.currentIndex);

	return this;

};

G.FrameAnimation.prototype.update = function() {

	if (!this.active) return;

	this.currentTimer+=G.deltaTime

	if (this.currentTimer >= this.timerEvery) {

		this.currentTimer = this.currentTimer-this.timerEvery;
		this.currentIndex += this.animDir;

		if (this.bounce) {
			if (this.currentIndex == this.animFramesLen || this.currentIndex == 0) {

				if (this.loop == 0 && this.currentIndex == 0) {
					this.onFinish.dispatch();
					return this.active = false;
				}

				if (this.loop > 0 && this.currentIndex == 0) {
					this.loop--;
				}

				if (this.currentIndex == this.animFramesLen) this.currentIndex = this.animFramesLen-1;
				
				this.animDir *= -1;

			}
		}else {

			if (this.currentIndex == this.animFramesLen) {
				if (this.loop == 0) {
					this.onFinish.dispatch();
					return this.active = false;
				}
				if (this.loop > 0) this.loop--;

				this.currentIndex = 0;

			}

		}

		G.changeTexture(this,this.frameNamePrefix+'_'+this.currentIndex);

	}

};

G.FrameAnimation.prototype.getAnimationLength = function(frameNamePrefix) {

	if (G.FrameAnimation.CacheAnimLength[frameNamePrefix]) return G.FrameAnimation.CacheAnimLength[frameNamePrefix];

	var len = 0;

	for (var i = 0; i < 1000; i++) {
		if (G.isImageInCache(frameNamePrefix+'_'+i)) {
			len++;
		}else {
			break;
		}
	}

	G.FrameAnimation.CacheAnimLength[frameNamePrefix] = len;

	return len;

};

G.FrameAnimation.CacheAnimLength = {};
/*G.Gift = function(type) {

	if (type === undefined) type = this.createRandom();

	if (type.constructor == G.Gift) return type;

	if (Array.isArray(type)) arguments = type;
	
	this.type = arguments[0];
	this.amount = arguments[1];
	this.icon = G.json.settings.gifts.icons[this.type];

	this.dataArray = Array.prototype.slice.call(arguments);

	this.applied = false;

};

G.Gift.prototype.createRandom = function() {


	var possibleGifts = [];
	
	G.json.settings.gifts.normals.list.forEach(function(e) {
		console.log(e);
		if (e[0] == 'coin') {
			possibleGifts.push(e);
		}else if (e[0].indexOf('booster') !== -1 && G.saveState.isBoosterUnlocked(parseInt(e[0][8]))) {
			possibleGifts.push(e);
		}
	});


	console.log(possibleGifts);

	return game.rnd.pick(possibleGifts);

};


G.Gift.prototype.getLabelString = function() {

	if (this.type == 'coin') {
		return	this.amount+' @'+this.icon+'@';
	}else if (this.type.indexOf('booster') !== -1) {
		return this.amount+'x '+'@'+this.icon+'@';
	}

};

G.Gift.prototype.getData = function() {

	return this.dataArray;

};

G.Gift.prototype.applyGift = function() {

	if (this.applied) return;

	if (this.type == 'coin') {
		G.saveState.changeCoins(this.amount);
	}else if (this.type.indexOf('booster') != -1) {
		G.saveState.changeBoosterAmount(parseInt(this.type[8]),this.amount);
	}

	this.applied = true;

}*/


G.gift = {};

G.gift.getGift = function(giftsGroup) {

	var giftsGroup = giftsGroup || 'normals';

	var giftsObj = G.json.settings.gifts[giftsGroup];

	var boosterMaxNr = giftsObj.boosterMaxNr || G.json.settings.gifts.boosterMaxNr;
	var boosterChance = giftsObj.boosterChance || G.json.settings.gifts.boosterChance;

	console.log(boosterMaxNr + ' & ' + boosterChance);

	var possibleGifts = [];

	
	
	giftsObj.list.forEach(function(e) {
		if (e[0] == 'coin') {
			possibleGifts.push(e);
		}else {

			if (e[0].indexOf('booster') !== -1 
			&& G.saveState.isBoosterUnlocked(parseInt(e[0][8])) 
			&& G.saveState.getBoosterAmount(parseInt(e[0][8])) < boosterMaxNr) {
				possibleGifts.push(e);
			}

		}
	});

	Phaser.ArrayUtils.shuffle(possibleGifts);

	var booster = Math.random() < boosterChance;

	for (var i = 0; i < possibleGifts.length; i++) {
		var gift = possibleGifts[i];
		if (gift[0].indexOf('booster') !== -1) {
			if (booster) {
				return gift.slice();
			}
		}else {
			return gift.slice();
		}
	}

	// fallback

	return ['coin',50];

};

G.gift.getLabelString = function(giftData) {
	return giftData[1]+' @'+G.json.settings.gifts.icons[giftData[0]]+'@';
};

G.gift.applyGift = function(giftData) {

	if (giftData[0] == 'coin') {
		G.saveState.changeCoins(giftData[1]);
	}else {
		G.saveState.changeBoosterAmount(parseInt(giftData[0][8]),giftData[1]);
	}

};

G.gift.getIcon = function(giftData) {

	return G.json.settings.gifts.icons[giftData[0]];

};
if (typeof G == 'undefined') G = {};

G.GridArray = function(width,height,value,dbg) {

	if (typeof width == 'number') {

		this.createGrid.apply(this,arguments);
		
	} else if (typeof width == "string")  {

		this.data = JSON.parse(arguments[0]);
		this.width = this.data.length;
		this.height = this.data[0].length;

	} else if (Array.isArray(width)) {
		a = arguments[0];
		this.data = arguments[0];
		this.width = this.data.length; 
		this.height = this.data[0].length;

	}

};

G.GridArray.prototype = {

	createGrid: function(width,height,value) {

		this.data = []; 
		this.width = width;
		this.height = height;

		for (var collumn = 0; collumn < width; collumn++) {
			this.data[collumn] = [];
			for (var row = 0; row < height; row++) {
				this.data[collumn][row] = value;
			}
		}

	},

	set: function(x,y,val) {
		if (this.isInGrid(x,y)) {
			return this.data[x][y] = val;
		}else {
			if (this.dbg) console.log("setValue OUT OF RANGE");
			return false;
		}
	},

	get: function(x,y) {
		if (this.isInGrid(x,y)) {
			return this.data[x][y];
		}else {
			if (this.dbg) console.log("getValue OUT OF RANGE");
			return false;
		}
	},

	swapValues: function(x1,y1,x2,y2) {

		if (this.isInGrid(x1,y1) && this.isInGrid(x2,y2)) {
			var tmp = this.data[x1][y1];
			this.data[x1][y1] = this.data[x2][y2];
			this.data[x2][y2] = tmp;
		}else {
			if (this.dbg) console.log("swapValues OUT OF RANGE");
			return false;
		}
		
	},

	isInGrid: function(x,y) {
		return !(x < 0 || x >= this.width || y < 0 || y >= this.height);
	},


	find: function(func,context) {

		for (var coll = 0; coll < this.width; coll++) {
			for (var row = 0; row < this.height; row++) {
				var val = func.call(context,this.data[coll][row],coll,row,this.data);
				if (val) return this.data[coll][row];
			}
		}

		return false;

	},


	filter: function(func,context) {

		var result = [];

		for (var coll = 0; coll < this.width; coll++) {
			for (var row = 0; row < this.height; row++) {
				var val = func.call(context,this.data[coll][row],coll,row,this.data);
				if (val) result.push(this.data[coll][row]);
			}
		}

		return result;
	},


	loop: function(func,context) {

		for (var coll = 0; coll < this.width; coll++) {
			for (var row = 0; row < this.height; row++) {
				func.call(context,this.data[coll][row],coll,row,this.data);
			}
		}
	},

	clear: function(value) {
		this.loop(function(elem,x,y,array) {
			array[x][y] = value || false;
		});
	},

	findPattern: function(positions,mark) {

		var result = false;
		var len = positions.length;

		this.loop(function(elem,x,y,array) {
			if (elem == mark && !result) {

				for (var i = 0; i < len; i+=2) {
					//console.log('pos: '+(x+positions[i])+'x'+(y+positions[i+1])+' val: ' + this.get(x+positions[i],y+positions[i+1]));
					if (!this.get(x+positions[i],y+positions[i+1])) return;
					if (this.get(x+positions[i],y+positions[i+1]) !== mark) return;
				}

				//console.log("PASSED FIRST LOOP "+x+'x'+y);
				result = [];
				for (var j = 0; j < len; j+=2) {
					result.push(x+positions[j],y+positions[j+1]);
				}
				//console.log('got patt: ');
				//console.log(x+'x'+y);
				//console.log(result);


			}
		},this);

		return result;

	},

	count: function(){

		var result = 0;

		for (var coll = 0; coll < this.width; coll++) {
			for (var row = 0; row < this.height; row++) {
				if (this.data[coll][row]) {
					result++;
				}
			}
		}

		return result;

	},

	getAllElements: function(){

		var result = [];

		for (var coll = 0; coll < this.width; coll++) {
			for (var row = 0; row < this.height; row++) {
				if (this.data[coll][row]) {
					result.push(this.data[coll][row]);
				}
			}
		}

		return result;

	}


};
G.Image = function(x,y,frame,anchor,groupToAdd) {

  Phaser.Image.call(this,game,G.l(x),G.l(y),null);

  //overwrite angle component, so angle is not wrapped anymore
  Object.defineProperty(this, 'angle', {
    get: function() {
        return Phaser.Math.radToDeg(this.rotation);
    },
    set: function(value) {
        this.rotation = Phaser.Math.degToRad(value);
    }
  });
  
  this.angle = 0;

  this.state = game.state.getCurrentState();

  this.changeTexture(frame);

  if (anchor) {
    if (typeof anchor == 'number') { 
        this.anchor.setTo(anchor);
    }else {
        this.anchor.setTo(anchor[0],anchor[1]);
    }
  }

  if (groupToAdd) { 
    (groupToAdd.add || groupToAdd.addChild).call(groupToAdd,this);
  }else if (groupToAdd !== null) {
    game.world.add(this);
  }

  

  
  //game.add.existing(this)
};

G.Image.prototype = Object.create(Phaser.Image.prototype);

G.Image.prototype.stopTweens = function() {
  G.stopTweens(this);
};

G.Image.prototype.changeTexture = function(image) {
  G.changeTexture(this,image);
};

Phaser.Image.prototype.changeTexture = function(image){
  G.changeTexture(this,image);
};

G.Image.prototype.add = function(obj) {
  return this.addChild(obj)
};
G.LabelGroupT = function(str,x,y,textStyle,anchor,maxWidth,distanceBetween){

	Phaser.Group.call(this,game);

	this.str = str;
	this.tagArray = G.LabelParser.changeIntoTagArray(str);

	this.x = x;
	this.y = y;
	this.textStyle = textStyle;
	this.fontSize = parseInt(textStyle.fontSize);

	this.distanceBetween = distanceBetween || 0;

    if (typeof anchor == 'number') { 
        this.anchorX = this.anchorY = anchor;
    }else {
        this.anchorX = anchor[0];
        this.anchorY = anchor[1];
    }
	

	this.maxWidth = maxWidth || 0;

	this.processTagArray();

};

G.LabelGroupT.prototype = Object.create(Phaser.Group.prototype);

G.LabelGroupT.prototype.processTagArray = function(){

	for (var i = 0; i < this.tagArray.length; i++) {
		if (this.tagArray[i].type == 'img') {
			var img = G.makeImage(0,0,this.tagArray[i].content,0,this);
			img.tagScale = this.tagArray[i].scale;
		}else if(this.tagArray[i].type == 'separator') {
			var img = G.makeImage(0,0,null,0,this);
			img.SEPARATOR = true;
			img.SEP_LENGTH = this.tagArray[i].length;
		}else {
			this.add(new G.Text(0,0,this.tagArray[i].content,this.textStyle))
		}
	}

	this.refresh();

};

G.LabelGroupT.prototype.refresh = function(){

	this.applySizeAndAnchor();

	if (this.maxWidth > 0 && this.getWholeWidth() > this.maxWidth) {
		while(this.getWholeWidth() > this.maxWidth) {
			this.distanceBetween = Math.floor(this.distanceBetween*0.9);
			this.fontSize = Math.floor(this.fontSize*0.9);
			this.applySizeAndAnchor();
		}
	}
	
	this.spreadElements();

};


G.LabelGroupT.prototype.applySizeAndAnchor = function() {

	this.children.forEach(function(e) {
		e.anchor.setTo(this.anchorX,this.anchorY);
		if (e.fontSize) {
			e.fontSize = this.fontSize;
			e.updateTransform();
		}else {
			e.height = this.fontSize*(e.tagScale || 1);
			e.scale.x = e.scale.y;
		}

		if (e.SEPARATOR) {
			e.width = this.fontSize*e.SEP_LENGTH;
		}
		
	},this);

};

G.LabelGroupT.prototype.getWholeWidth = function() {

	var allDistanceBetween = (this.children.length-1) * this.distanceBetween;
	var widthOfAllElements = 0;
	this.children.forEach(function(e) {
		widthOfAllElements += e.width;
	});
	return allDistanceBetween + widthOfAllElements;

};

G.LabelGroupT.prototype.spreadElements = function() {

	var startX = this.getWholeWidth()*this.anchorX*-1;
	this.children.forEach(function(e,index,array) {
		e.left = (index== 0 ? startX : array[index-1].right+this.distanceBetween);
	},this);

};
//
// $ - text from json
// @ - img
// % - variable
// ^ - text as it is
//


G.LabelParser = {
	
	specialChars: ['$','@','%','^'],
	
	changeIntoTagArray: function(str,propObj) {

		var result = [];

		var i = 0;

		while (str.length > 0) {

			if (i++ > 20) break;

			var firstTag = this.findFirstSpecialChar(str);


			if (firstTag === -1) {
				result.push(str);
				break;
			}else {

				if (firstTag[0] > 0) {
					result.push(str.slice(0,firstTag[0]))
					str = str.slice(firstTag[0]);	
				}
				str = this.cutOffTag(str,result,firstTag[1]); 

			}

		} 

		// 
		// change strings into objects
		//

		var processedResult = [];
		for (var i = 0; i < result.length; i++) {
			processedResult.push(this.processTag(result[i],propObj));
		}

		// 
		// merge texts obj
		// 
		//

		return this.mergeTextTagsInArray(processedResult);;
	},


	mergeTextTagsInArray: function(tagArray) {

		var mergedArray = [];

		var startIndex = null;
		var endIndex = null;

		for (var i = 0; i < tagArray.length; i++) {

			if (tagArray[i].type !== 'text') {

				if (startIndex !== null) {
					mergedArray.push(this.mergeTextTags(tagArray,startIndex,i));
					startIndex = null;
				}

				mergedArray.push(tagArray[i]);				

			}else {
				if (startIndex == null) {
					startIndex = i;
				}
			}
		}


		if (startIndex !== null) {
			mergedArray.push(this.mergeTextTags(tagArray,startIndex,i))
		}

		return mergedArray;

	},

	mergeTextTags: function(array,startIndex,endIndex) {

		var newObj = {type:'text',content:[]};

		for ( ; startIndex < endIndex; startIndex++) {
			newObj.content.push(array[startIndex].content);
		}

		newObj.content = newObj.content.join(' ');

		return newObj;

	},

	processTag: function(elem,propObj) {

		if (elem[0] == '@') {

			var scale = 1;

			if (elem[1] == '*' && elem.indexOf('*',2)) {
				scale = parseFloat(elem.slice(elem.indexOf('*')+1,elem.indexOf('*',2)));
				elem = elem.slice(elem.indexOf('*',2));
			}

			return {
				type: 'img',
				content: elem.slice(1,-1),
				scale: scale
			}
		}else if (elem[0] == '%') {
			return {
				type: 'text',
				content: propObj[elem.slice(1,-1)]
			}
		}else if (elem[0] == '$') {
			
			return {
				type: 'text',
				content: G.txt(elem.slice(1,-1))
			}
		}else if (elem[0] == '^') {
			return {
				type: 'text',
				content: elem.slice(1,-1)
			}
		}else {

			if (this.isStringJustSpaces(elem)) {
				return {
					type: 'separator',
					content: elem,
					length: elem.length
				}
			}else {
				return {
					type: 'text',
					content: elem 
				}
			}

		}


	},

	isStringJustSpaces: function(elem) {
		for (var i = 0; i < elem.length; i++) {
			if (elem[i] !== ' ') return false;
		}
		return true;
	},

	cutOffTag: function(str,result,tag) {

		var startIndex = str.indexOf(tag);
		var endIndex = str.indexOf(tag,startIndex+1);

		result.push(str.slice(startIndex,endIndex+1));

		return str.slice(0,startIndex) + str.slice(endIndex+1);

	},

	findFirstSpecialChar: function(str) {

			var smallest = Infinity;
			var foundedChar = false;

			this.specialChars.forEach(function(char) {
				var index = str.indexOf(char)
			
				if (index > -1 && smallest > index) {
					foundedChar = char;
					smallest = Math.min(index,smallest);
				}
			});

			if (smallest === Infinity) return -1;

			return [smallest, foundedChar];

	},


	createLabel: function(string,propObj,x,y,font,fontSize,anchorX,anchorY,distanceBetween,maxWidth) {

		var tagArray = this.changeIntoTagArray(string,propObj);

		var group = new G.LabelGroup(x,y,fontSize,distanceBetween,anchorX,anchorY,maxWidth);

		

		return group;

	}

} 


G.LabelGroup = function(str,x,y,font,fontSize,anchorX,anchorY,maxWidth) {

	Phaser.Group.call(this,game);

	this.fontData = game.cache.getBitmapFont(font).font;
	this.fontBaseSize = this.fontData.size;
	this.fontSpaceOffset = this.fontData.chars['32'].xOffset + this.fontData.chars['32'].xAdvance;

	this.str = str;
	this.tagArray = G.LabelParser.changeIntoTagArray(str);


	this.x = (typeof x === 'undefined' ? 0 : G.l(x));
	this.y = (typeof y === 'undefined' ? 0 : G.l(y));
	this.font = font;
	this.fontSize = (typeof fontSize === 'undefined' ? G.l(30) : G.l(fontSize));
	//this.distanceBetween = (typeof distanceBetween === 'undefined' ? G.l(10) : G.l(distanceBetween));
	this.distanceBetween = 0;

	this.anchorX = (typeof anchorX === 'undefined' ? 0.5 : anchorX);
	this.anchorY = (typeof anchorY === 'undefined' ? 0.5 : anchorY);

	this.maxWidth = maxWidth || 0;

	this.processTagArray();

};

G.LabelGroup.prototype = Object.create(Phaser.Group.prototype);

G.LabelGroup.prototype.processTagArray = function() {

	for (var i = 0; i < this.tagArray.length; i++) {
		if (this.tagArray[i].type == 'img') {
			var img = G.makeImage(0,0,this.tagArray[i].content,0,this);
			img.tagScale = this.tagArray[i].scale;
		}else if(this.tagArray[i].type == 'separator') {
			var img = G.makeImage(0,0,null,0,this);
			img.SEPARATOR = true;
			img.SEP_LENGTH = this.tagArray[i].length;
		}else {
			this.add(game.add.bitmapText(0,0,this.font,this.tagArray[i].content,this.fontSize))
		}
	}


	this.refresh();

};

G.LabelGroup.prototype.refresh = function() {

	this.applySizeAndAnchor();

	if (this.maxWidth > 0 && this.getWholeWidth() > this.maxWidth) {
		while(this.getWholeWidth() > this.maxWidth) {
			this.distanceBetween *= 0.9;
			this.fontSize *= 0.9;
			this.applySizeAndAnchor();
		}
	}
	
	this.spreadElements();

};

G.LabelGroup.prototype.applySizeAndAnchor = function() {

	this.children.forEach(function(e) {
		e.anchor.setTo(this.anchorX,this.anchorY);

		if (e.fontSize) {
			e.fontSize = this.fontSize;
			e.updateText();
		}else {
			e.height = this.fontSize*(e.tagScale || 1);
			e.scale.x = e.scale.y;
		}

		

		if (e.SEPARATOR) {
			e.width = (this.fontSize/this.fontBaseSize*this.fontSpaceOffset)*e.SEP_LENGTH;
		}
		
	},this);

};

G.LabelGroup.prototype.getWholeWidth = function() {

	var allDistanceBetween = (this.children.length-1) * this.distanceBetween;
	var widthOfAllElements = 0;
	this.children.forEach(function(e) {
		widthOfAllElements += e.width;
	});

	return allDistanceBetween + widthOfAllElements;
};

G.LabelGroup.prototype.spreadElements = function() {

	var startX = this.getWholeWidth()*this.anchorX*-1

	this.children.forEach(function(e,index,array) {
		e.left = (index== 0 ? startX : array[index-1].right+this.distanceBetween);
	},this);

};
G.LineEditor = function(){

	Phaser.Group.call(this,game);

	this.gfx = game.add.graphics();
	this.gfx.fixedToCamera = true;

	this.points = {
		x: [],
		y: []
	};

	this.currentIndex = null;
	this.pointerStart = new Phaser.Point(0,0);

	this.interpolation = 'linearInterpolation';

	game.input.onDown.add(function(pointer){
		this.currentIndex = this.findCurrentIndex(pointer);
		if (this.currentIndex !== null){
			this.pointerStart.x = pointer.x;
			this.pointerStart.y = pointer.y;
		}
	},this);


	game.input.onUp.add(function(pointer){
		this.currentIndex = null;
	},this);

	this.keys = game.input.keyboard.addKeys({
		Z: Phaser.Keyboard.Z,
		X: Phaser.Keyboard.X,
		C: Phaser.Keyboard.C,
		A: Phaser.Keyboard.A,
		S: Phaser.Keyboard.S,
		D: Phaser.Keyboard.D
	});

	this.keys.Z.onDown.add(function(){
		this.interpolation = 'catmullRomInterpolation';
	},this);

	this.keys.X.onDown.add(function(){
		this.interpolation = 'bezierInterpolation';
	},this);

	this.keys.C.onDown.add(function(){
		this.interpolation = 'linearInterpolation';
	},this);

	this.keys.A.onDown.add(function(){
		var pointer = game.input.activePointer;
		this.points.x.push(pointer.x);
		this.points.y.push(pointer.y);
	},this);

	this.keys.S.onDown.add(function(){
		if (this.currentIndex){
			this.points.x.splice(this.currentIndex,1);
			this.points.y.splice(this.currentIndex,1);
		}
	},this);

	this.keys.D.onDown.add(function(){
		this.points.x.pop();
		this.points.y.pop();
	},this);

};

G.LineEditor.prototype = Object.create(Phaser.Group.prototype);

G.LineEditor.prototype.update = function(){

	if (this.currentIndex){
		var pointer = game.input.activePointer;
		var diffX = this.pointerStart.x - pointer.x;
		var diffY = this.pointerStart.y - pointer.y;
		this.pointerStart.x = pointer.x;
		this.pointerStart.y = pointer.y;
		this.points.x[this.currentIndex] -= diffX;
		this.points.y[this.currentIndex] -= diffY;
	}

	this.redraw();

};

G.LineEditor.prototype.findCurrentIndex = function(pointer){

	var index = null;
	var min = Infinity;

	for (var i = 0; i < this.points.x.length; i++){
		var dist = game.math.distance(pointer.x,pointer.y,this.points.x[i],this.points.y[i]);
		if (dist < min){
			index = i;
			min = dist;
		}
	}

	if (min < 10){
		return index;
	}else{
		return index;
	}

};


G.LineEditor.prototype.redraw = function(){

	this.gfx.clear();
	this.drawLine();
	this.drawPoints();

};

G.LineEditor.prototype.drawPoints = function(){

	this.gfx.lineStyle(2,0x0000ff,1);
	this.gfx.beginFill(0x0000ff,0.5);
	for (var i = 0; i < this.points.x.length; i++){
		this.gfx.drawCircle(
			this.points.x[i],
			this.points.y[i],
			10
		);
	}

};

G.LineEditor.prototype.drawLine = function(){

	if (this.points.x.length == 0) return;

	this.gfx.lineStyle(2,0xff0000,1);
	this.gfx.moveTo(this.points.x[0],this.points.y[0]);
	for (var i = 0; i < 1; i+=0.001){
		var x = game.math[this.interpolation](this.points.x,i);
		var y = game.math[this.interpolation](this.points.y,i);
		this.gfx.lineTo(x,y);
	}

};
if (typeof G == 'undefined') G = {};

G.Loader = {

	currentConfig : 'hd',
	currentConfigMulti : 1,
	loadingScreenActive: false, 
	lang: false,

	passConfigs: function(conf) {
		this.configs = conf;
	},

	setConfig: function(chosen) {
		this.currentConfig = chosen;
		this.currentConfigMulti = this.configs[chosen];
	},

	killLoadingScreen: function() {

		if (G.imgRotate) {
			G.whiteOverlay.destroy();
			G.imgRotate.fadeOut = true;
			G.imgRotate = false;
			this.loadingScreenActive = false;
		}

	},

	loadPOSTImage: function(name) {

		if (typeof name === 'undefined') return;

		if (!game.cache.checkImageKey(name)) {
			this.makeLoadingScreen();
			game.load.image(name,'assets/'+this.currentConfig+'/imagesPOST/'+name);
		}

	},

	loadBootAssets:function(lang){

		if (lang) this.lang = lang.toUpperCase();

		G.ASSETS.images.forEach(function(fileName) {
			if (!this.checkIfLoad(fileName,true)) return;
			console.log('loading ',fileName);
			game.load.image(
				this.removeExt(this.cutOffPrefixes(fileName)),
				'assets/'+this.currentConfig+'/images/'+fileName
			);
		},this); 

		G.ASSETS.spritesheets.forEach(function(elem) {
			if (!this.checkIfLoad(elem,true)) return;
			console.log('loading ',elem);
			game.load.atlasJSONHash(this.cutOffPrefixes(elem),'assets/'+this.currentConfig+'/spritesheets/'+elem+'.png','assets/'+this.currentConfig+'/spritesheets/'+elem+'.json');
		},this);

		game.load.onLoadComplete.addOnce(function(){
			this.createSpritesheetMap(true);
		},this);

	},

	loadAssets: function(lang) {

		if (lang) this.lang = lang.toUpperCase();

		game.load.onLoadComplete.addOnce(this.processAssets,this);
  	this.loadSFX(G.ASSETS.sfx);
  	this.loadImages(G.ASSETS.images);
  	this.loadSpritesheets(G.ASSETS.spritesheets);
  	this.loadJson(G.ASSETS.json);
  	this.loadFonts(G.ASSETS.fonts);

	},

	processAssets: function() {
		this.processJson(G.ASSETS.json);
		this.processSFX(G.ASSETS.sfx);

		this.createSpritesheetMap();

	},

	createSpritesheetMap: function(boot) {

		console.log('create spritesheets map');

		if (!G.spritesheetMap) G.spritesheetMap = {};

		for (var i = 0, len = G.ASSETS.spritesheets.length; i < len; i++) {
			
			if (!this.checkIfLoad(G.ASSETS.spritesheets[i],boot)) continue;
			var sheetName = this.cutOffPrefixes(G.ASSETS.spritesheets[i]);

      if (game.cache.checkImageKey(sheetName)) {

          var sheet = game.cache.getFrameData(sheetName);

          for (var frameIndex = 0; frameIndex < sheet._frames.length; frameIndex++) {

          	var frame = sheet._frames[frameIndex];

          	if (G.spritesheetMap[frame.name]) console.warn('Images name collision: '+frame.name);

          	G.spritesheetMap[frame.name] = sheetName;

          }
      }
  	} 

	},

	loadSFX: function(list) {
		list.forEach(function(fileName) {
			game.load.audio(
				this.removeExt(fileName),
				'assets/sfx/'+fileName
			);
		},this);
	},

	loadFonts: function(fontObj) {
		for (var font in fontObj) {
			if (!this.checkIfLoad(font)) return;
			game.load.bitmapFont(this.cutOffPrefixes(font),'assets/'+this.currentConfig+'/fonts/'+fontObj[font].frame,'assets/'+this.currentConfig+'/fonts/'+fontObj[font].data);
		}
	},

	loadImages: function(list) {
		list.forEach(function(fileName) {
			if (!this.checkIfLoad(fileName)) return;
			game.load.image(
				this.removeExt(this.cutOffPrefixes(fileName)),
				'assets/'+this.currentConfig+'/images/'+fileName
			);
		},this);
	},

	loadJson: function(list) {
		list.forEach(function(fileName) {
			game.load.json(this.removeExt(fileName), 'assets/json/'+fileName);
		},this);
	},

	loadSpritesheets: function(list) {

		list.forEach(function(elem) {
			if (!this.checkIfLoad(elem)) return;
			game.load.atlasJSONHash(this.cutOffPrefixes(elem),'assets/'+this.currentConfig+'/spritesheets/'+elem+'.png','assets/'+this.currentConfig+'/spritesheets/'+elem+'.json');
		},this);
	},

	checkIfLoad: function(fileName,bootPhase){

		if (bootPhase && fileName.indexOf('BOOT-') == -1) return false;
		if (!bootPhase && fileName.indexOf('BOOT-') !== -1) return false;
		if (fileName.indexOf('MOBILE-') !== -1 && game.device.desktop) return false;
		if (fileName.indexOf('DESKTOP-') !== -1 && !game.device.desktop) return false;

		if (this.lang && fileName.match(/^[A-Z]{2}\-/)){
			return fileName.indexOf(this.lang+'-') == 0;
		}else{
			return true;
		}

	},

	cutOffPrefixes: function(fileName){

		//cut off lang prefix
		fileName = fileName.replace(/^[A-Z]{2}\-/,'');

		fileName = fileName.replace('BOOT-','');
		fileName = fileName.replace('MOBILE-','');
		fileName = fileName.replace('DESKTOP-','');

		return fileName;

	},

	removeExt: function(fileName){
		return fileName.slice(0,fileName.lastIndexOf('.'));
	},

	processJson: function(list) {
		G.json = {};
		list.forEach(function(fileName) {
			fileName = this.removeExt(fileName);
			G.json[fileName] = game.cache.getJSON(fileName);
		},this); 
	},

	processSFX: function(list) {
		G.sfx = {};
		game.sfx = G.sfx;

		var clusters = {};

		list.forEach(function(elem) {

			elem = this.removeExt(elem);

			G.sfx[elem] = game.add.audio(elem);

			var lastIndex = elem.lastIndexOf('_');

			if (lastIndex !== -1 && !isNaN(elem.slice(lastIndex+1))){
				var number = parseInt(elem.slice(lastIndex+1)); 
				var name = elem.slice(0,lastIndex);
				if (!clusters[name]) clusters[name] = [];
				clusters[name].push(G.sfx[elem]);
			};
		},this);

		Object.keys(clusters).forEach(function(key){

			G.sfx[key] = {
				sfxArray: clusters[key],
				//play rnd
				play: function(volume, loop, forceRestart){
					game.rnd.pick(this.sfxArray).play('', 0, volume, loop, forceRestart);
				}
			}

		});
 
	},

};
G.MultiLineText = function(x,y,font,text,size,max_width,max_height,align,hAnchor,vAnchor) {  
  
  x = G.l(x);
  y = G.l(y);
  size = G.l(size);
  max_width = G.l(max_width);
  max_height = G.l(max_height);

  this.maxUserWidth = max_width;
  this.maxUserHeight = max_height;

  Phaser.BitmapText.call(this, game, x, y, font,'',size);
  
  //this.maxWidth = max_width;
  this.splitText(text,max_width);

  this.align = align || 'center';
  
  if (max_height) {
      while (this.height > max_height) {
        this.fontSize -= 2;
        this.splitText(text,max_width);
        this.updateText();
        if (this.fontSize < 5) break;
      }
  }

  this.anchor.setTo(hAnchor,vAnchor);

 // this.hAnchor = typeof hAnchor == 'number' ? hAnchor : 0.5;
  //this.vAnchor = typeof vAnchor == 'number' ? vAnchor : 0;

  this.cacheAsBitmap = true; 
  //this._cachedSprite.anchor.setTo(this.hAnchor,this.vAnchor);

};

G.MultiLineText.prototype = Object.create(Phaser.BitmapText.prototype);
G.MultiLineText.prototype.constructor = G.MultiLineText;


G.MultiLineText.prototype.splitText = function(text,max_width) {

  var txt = text;
  var txtArray = [];
  var prevIndexOfSpace = 0;
  var indexOfSpace = 0;
  var widthOverMax = false;

  while (txt.length > 0) {

    prevIndexOfSpace = indexOfSpace;
    indexOfSpace = txt.indexOf(' ',indexOfSpace+1);

    
    if (indexOfSpace == -1) this.setText(txt);
    else this.setText(txt.substring(0,indexOfSpace));
    this.updateText();

    if (this.width > max_width) {

      if (prevIndexOfSpace == 0 && indexOfSpace == -1) {
        txtArray.push(txt);
        txt = '';
        indexOfSpace = 0;
        continue;
      }

      if (prevIndexOfSpace == 0) {
        txtArray.push(txt.substring(0,indexOfSpace));
        txt = txt.substring(indexOfSpace+1);
        indexOfSpace = 0;
        continue;
      }

      txtArray.push(txt.substring(0,prevIndexOfSpace));
      txt = txt.substring(prevIndexOfSpace+1);
      indexOfSpace = 0;


    }else {
      //ostatnia linijka nie za dluga
      if (indexOfSpace == -1) {
        txtArray.push(txt);
        txt = '';
      } 

    }
  
  }


  this.setText(txtArray.join('\n'));


};



G.MultiLineText.prototype.popUpAnimation = function() {
  
  this.cacheAsBitmap = false;

  var char_numb = this.children.length;
 
  //
  var delay_array = [];
  for (var i = 0; i < char_numb; i++) {
    delay_array[i] = i;
  }
 
  delay_array = Phaser.ArrayUtils.shuffle(delay_array);
  delay_index = 0;
  this.activeTweens = 0;

  this.children.forEach(function(letter) {
 
      if (letter.anchor.x == 0) {
        letter.x = letter.x + (letter.width*0.5);
        letter.y = letter.y + letter.height;
        letter.anchor.setTo(0.5,1);
      }
      var target_scale = letter.scale.x;
      letter.scale.setTo(0,0);
      this.activeTweens++;
      var tween = game.add.tween(letter.scale)
        .to({x:target_scale*1.5,y:target_scale*1.5},200,Phaser.Easing.Quadratic.In,false,delay_array[delay_index]*25)
        .to({x:target_scale,y:target_scale},200,Phaser.Easing.Sinusoidal.In);
      tween.onComplete.add(function() {this.activeTweens--; if (this.activeTweens == 0) {if (this.alive) this.cacheAsBitmap = true;}},this);
      tween.start();
      delay_index++; 
    },this)
};
G.OneLineText = function(x,y,font,text,size,width,hAnchor,vAnchor) {  

  Phaser.BitmapText.call(this, game, G.l(x), G.l(y), font, text, G.l(size), G.l(width));

  if (width) {
      while (this.width > G.l(width)) {
        this.fontSize -= 2;
        this.updateText();
        if (this.fontSize < 5) break;
      }
  }


  this.orgFontSize = G.l(size);

  this.maxUserWidth = G.l(width);

  
  this.skipCaching = G.skipOneLineTextCaching || false;

  this.hAnchor = hAnchor;
  this.vAnchor = vAnchor;

  this.anchor.setTo(this.hAnchor,this.vAnchor);
  this.updateText();


  this.insertCoin(this.fontSize);

  if (!this.skipCaching) {
    this.cacheAsBitmap = true;
    this.updateCache();
  }

  

  //this._cachedSprite.anchor.setTo(typeof this.hAnchor == 'undefined' ? 0.5 : this.hAnchor,this.vAnchor || 0);

  //this.x -= Math.floor(this.width*0.5);


};


G.OneLineText.prototype = Object.create(Phaser.BitmapText.prototype);
G.OneLineText.prototype.constructor = G.OneLineText;

G.OneLineText.prototype.insertCoin = function(size) {


  if (this.text.indexOf('$$') == -1) return;


  this.children.forEach(function(element,index,array) {

    if (!element.name) return;

    if (element.name == "$" && element.visible) {
      if (index+1 <= array.length-1 && array[index].name == '$') {

        var el = element;
        var el2 = array[index+1];

        el.visible = false;
        el2.visible = false;
        coin = G.makeImage(el.x+(size*0.05),el.y-(size*0.05),'coin');
        coin.width = size;
        coin.height = size;
        el.parent.addChild(coin);


      }
    }


  });

} 


G.OneLineText.prototype.setText = function(text) {

  Phaser.BitmapText.prototype.setText.call(this,text.toString());

  var oldScaleX = this.scale.x;
  var oldScaleY = this.scale.y;
  var oldAlpha = this.alpha;
  var oldAngle = this.angle;

  this.alpha = 1;
  this.scale.setTo(1);


  if (this.maxUserWidth) {
    this.fontSize = this.orgFontSize;
    this.updateText();
    var i = 0;
    while (this.width > this.maxUserWidth) {
      this.fontSize -= 1;

      this.updateText();
      if (this.fontSize < 5) break;
    }
  }

  if (!this.skipCaching && this.cacheAsBitmap) this.updateCache();

  this.scale.setTo(oldScaleX,oldScaleY);
  this.alpha = oldAlpha;
  this.angle = oldAngle;
  //this._cachedSprite.anchor.setTo(this.hAnchor || 0.5,1);

};


G.OneLineText.prototype.popUpAnimation = function() {
  
  this.cacheAsBitmap = false;

  var char_numb = this.children.length;
 
  //
  var delay_array = [];
  for (var i = 0; i < char_numb; i++) {
    delay_array[i] = i;
  }
 
  delay_array = Phaser.ArrayUtils.shuffle(delay_array);
  delay_index = 0;
  this.activeTweens = 0;

  this.children.forEach(function(letter) {
 
      if (letter.anchor.x == 0) {
        letter.x = letter.x + (letter.width*0.5);
        letter.y = letter.y + letter.height;
        letter.anchor.setTo(0.5,1);
      }
      var target_scale = letter.scale.x;
      letter.scale.setTo(0,0);
      this.activeTweens++;
      var tween = game.add.tween(letter.scale)
        .to({x:target_scale*1.5,y:target_scale*1.5},200,Phaser.Easing.Quadratic.In,false,delay_array[delay_index]*25)
        .to({x:target_scale,y:target_scale},200,Phaser.Easing.Sinusoidal.In);
      tween.onComplete.add(function() {this.activeTweens--; if (this.activeTweens == 0) {if (this.alive && !this.skipCaching) this.cacheAsBitmap = true;}},this);
      tween.start();
      delay_index++; 
    },this)
};

G.OneLineText.prototype.scaleOut = function(onComplete,context) {
  this.cacheAsBitmap = false;

  this.activeTweens = 0;


  this.children.forEach(function(letter,index) {

      if (letter.anchor.x == 0) {
        letter.x = letter.x + letter.width*0.5;
        letter.y = letter.y + letter.height*0.5;
        letter.anchor.setTo(0.5,0.5);
      }
      this.activeTweens++;
      letter.scale.setTo(letter.scale.x,letter.scale.y);

      var tween = game.add.tween(letter.scale)
        .to({x:0,y:0},400,Phaser.Easing.Cubic.In,false,index*20);
      tween.onComplete.add(function() {
        this.activeTweens--;
        if (this.activeTweens == 0) {this.destroy()}
       },this);
      tween.start();
    },this)

}





G.OneLineCounter = function(x,y,font,amount,size,width,hAnchor,vAnchor,preText,postText) {
  
  G.OneLineText.call(this,x,y,font,'',size,width,hAnchor,vAnchor);

  this.amount = amount;
  this.amountDisplayed = amount;
  this.amountMaxInterval = 5;
  this.amountMaxNegInterval = -5;

  this.absoluteDisplay = false;
  this.fixedToDecimal = 0;

  this.stepCurrent = 0;
  this.step = 0;

  this.preText = preText || '';
  this.postText = postText || '';

  this.setText(this.preText+amount+this.postText);

};

G.OneLineCounter.prototype = Object.create(G.OneLineText.prototype);

G.OneLineCounter.prototype.update = function() {

  if (this.lerp){
    this.lerpUpdate();
    return;
  }
  
  if (this.amountDisplayed != this.amount && this.stepCurrent-- <= 0) {
    this.stepCurrent = this.step;
  
    if (this.amountDisplayed != this.amount) {

      var diff = this.amount - this.amountDisplayed;

      this.amountDisplayed += game.math.clamp(diff,this.amountMaxNegInterval,this.amountMaxInterval);


      var valueToDisplay = this.amountDisplayed;

      if (this.absoluteDisplay) {valueToDisplay = Math.abs(valueToDisplay)};
      if (this.fixedTo != 0) {valueToDisplay = valueToDisplay.toFixed(this.fixedToDecimal)};

      this.setText(this.preText+valueToDisplay+this.postText);

    } 

  }

};

G.OneLineCounter.prototype.changeAmount = function(amount) {
  this.amount = amount;
};

G.OneLineCounter.prototype.increaseAmount = function(change) {
  this.amount += change;
};

G.OneLineCounter.prototype.changeIntervals = function(max,maxNeg) {

  if (typeof maxNeg == 'undefined') {
    this.amountMaxInterval = max;
    this.amountMaxNegInterval = -max;
  }else {
    this.amountMaxInterval = max;
    this.amountMaxNegInterval = maxNeg;
  }

} 

G.OneLineCounter.prototype.lerpUpdate = function(){

  if (this.amountDisplayed != this.amount && this.stepCurrent-- <= 0){
    this.stepCurrent = this.step;
    this.amountDisplayed = Math.round(G.lerp(this.amountDisplayed,this.amount,0.5,0.6));
    this.setText(this.amountDisplayed.toString());

  }

};
G.PartCacher = function() {

	Phaser.Group.call(this,game);
	
	this.active = false;	
	
	this.every = 1;

	this.rt = game.add.renderTexture(10,10);

	this.frameCounter = 0;

	this.framesToRecord = null;

};

G.PartCacher.prototype = Object.create(Phaser.Group.prototype);

G.PartCacher.prototype.update = function() {

	if (!this.active) return;

	this.stepForward();

	if (!this.checkChildren()) {
		this.active = false;
		this.removeAll(true,true);
		return;
	}

	if (this.frameCounter % this.frameRate === 0) {
		this.saveFrame();
		this.frameNr++;

		if (this.framesToRecord !== null){
			this.framesToRecord--;
			if (this.framesToRecord == 0) this.active = false;
		}

	}
	this.frameCounter++;

};

G.PartCacher.prototype.stepForward = function() {
	
	for (var i = this.children.length; i--; ) {
		this.children[i].update();
	}

};

G.PartCacher.prototype.start = function(fileName,frameRate,nrOfFrames){ 

	this.fileName = fileName;
	this.frameNr = 0;
	this.frameRate = 60/frameRate;
	this.active = true;
	this.frameCounter = 0;

	this.framesToRecord = nrOfFrames || null;

};

G.PartCacher.prototype.saveFrame = function() {

	var bounds = this.getBounds();

  var widthFromCenter = Math.max(this.x-bounds.x,bounds.x+bounds.width-this.x,400);
  var heightFromCenter = Math.max(this.y-bounds.y,bounds.y+bounds.height-this.y,400);
  this.rt.resize(widthFromCenter*2, heightFromCenter*2, true);
  this.rt.renderXY(this, widthFromCenter, heightFromCenter, true);

  var c = this.rt.getCanvas();
  var fileName = this.fileName+'_'+this.frameNr;

  c.toBlob(function(blob) {
    saveAs(blob, fileName);
	});

};

G.PartCacher.prototype.checkChildren = function() {

	var inactive = this.children.filter(function(child) {
		return !child.alive || child.alpha === 0 || child.scale.x == 0 || child.scale.y == 0; 
	});

	return this.children.length !== inactive.length;

};
G.PoolGroup = function(elementConstructor,argumentsArray,signal,initFill) {
	
	Phaser.Group.call(this,game);

	this._deadArray = [];
	this._elementConstructor = elementConstructor;
	this._argumentsArray = argumentsArray || [];
	this._argumentsArray.unshift(null);

	if (signal) {
		G.sb(signal).add(this.init,this);
	}

	if (initFill) {
		for (var i = 0; i < initFill; i++){
			element = new (Function.prototype.bind.apply(this._elementConstructor, this._argumentsArray));
			this.add(element);
			element.events.onKilled.add(this._onElementKilled,this);
			element.kill();

		}
	}

}

G.PoolGroup.prototype = Object.create(Phaser.Group.prototype);

G.PoolGroup.prototype.getFreeElement = function() {
	
	var element;

	if (this._deadArray.length > 0) {
		 element = this._deadArray.pop()
	}else {
		element = new (Function.prototype.bind.apply(this._elementConstructor, this._argumentsArray));
		element.events.onKilled.add(this._onElementKilled,this);
	}

	this.add(element);
	return element;

};

G.PoolGroup.prototype._onElementKilled = function(elem) {
	if (this !== elem.parent) return;
	this._deadArray.push(elem);
	this.removeChild(elem)

};

G.PoolGroup.prototype.init = function() {

	var elem = this.getFreeElement();
	elem.init.apply(elem,arguments);

	return elem;

};

G.PoolGroup.prototype.initBatch = function(nr) {

	for (var i = 0; i < nr; i++) {
		this.init.apply(this,[].slice.call(arguments,1));
	}

};
G.PreloaderBar = function(){
	
	Phaser.Group.call(this,game);
	this.fixedToCamera = true;

	this.softgamesBtn = game.add.button(0,200,'sg_logo',function(){
		SG_Hooks.triggerMoreGames();
	},this);
	this.softgamesBtn.anchor.setTo(0.5,0.5);
	this.add(this.softgamesBtn);

	this.gfx = game.add.graphics();
	this.add(this.gfx);
	this.drawProgress(0);

	G.sb('onScreenResize').add(this.onResize,this);
	this.onResize();

	game.load.onFileComplete.add(this.drawProgress,this);

};

G.PreloaderBar.prototype = Object.create(Phaser.Group.prototype);

G.PreloaderBar.prototype.onResize = function(){

	this.cameraOffset.x = game.width*0.5;
	this.cameraOffset.y = game.height*0.4;

};

G.PreloaderBar.prototype.drawProgress = function(progress){

	this.gfx.clear();
	this.gfx.lineStyle(2,0xffffff,1);
	this.gfx.beginFill(0x000000,1);
	this.gfx.drawRect(-150,0,300,50);
	this.gfx.beginFill(0xffffff,1);
	this.gfx.drawRect(-145,5,(progress/100)*290,40);

};
G.ProgressBar = function(x,y,sprite,currentValue,maxValue,offsetX,offsetY) {

	G.Image.call(this,x,y,sprite+'_empty',0,null);

	offsetX = typeof offsetX === 'undefined' ? 0 : offsetX;
	offsetY = typeof offsetY === 'undefined' ? 0 : offsetX;

	this.fill = G.makeImage(offsetX,offsetY,sprite+'_full',0,this);
	this.fillFullWidth = this.fill.width;

	this.fillOverlay = G.makeImage(offsetX,offsetY,sprite+'_full_overlay',this.fill,this);
	this.fillOverlay.alpha = 0;

	this.fill.cropRect = new Phaser.Rectangle(0,0,0,this.fill.height);	
	this.fill.updateCrop();

	this.currentValue = currentValue;
	this.prevCurrentValue = currentValue;

	this.targetValue = currentValue;

	//var used for lerp (so lerp dont stuck, because current value will be rounded)
	this.maxValue = maxValue;

	this.lerpValue = 0.05;

	this.updateBarCrop();

	this.onTargetReached = new Phaser.Signal();
	this.onBarFilled = new Phaser.Signal();

};

G.ProgressBar.prototype = Object.create(G.Image.prototype);

G.ProgressBar.prototype.update = function() {

	if (this.currentValue !== this.targetValue) {
		this.currentValue = G.lerp(this.currentValue,this.targetValue,this.lerpValue,this.maxValue*0.005);
		if (this.currentValue === this.targetValue) {
			this.onTargetReached.dispatch();
		}
	}

	if (this.currentValue !== this.prevCurrentValue) {
		this.updateBarCrop();

		if (this.currentValue === this.maxValue) {
			game.add.tween(this.fillOverlay).to({alpha:1},300,Phaser.Easing.Sinusoidal.InOut,true,0,0,true);
			this.onBarFilled.dispatch();
			if (this.label) {
				game.add.tween(this.label).to({alpha:0},600,Phaser.Easing.Sinusoidal.InOut,true);
			}
		}

		if (this.label) {
			if (Math.floor(this.currentValue) !== Math.floor(this.prevCurrentValue)) {
				console.log('updating label');
				this.label.updateValue(Math.floor(this.currentValue));
			}
		}

	}


	this.prevCurrentValue = this.currentValue;

};

G.ProgressBar.prototype.updateBarCrop = function() {

	var oldCropRectWidth = this.fill.cropRect.width;
	var newCropRectWidth = Math.round(this.fillFullWidth*(this.currentValue/this.maxValue));

	if (oldCropRectWidth !== newCropRectWidth) {
		this.fill.cropRect.width = newCropRectWidth;
		this.fill.updateCrop();
	}

};

G.ProgressBar.prototype.changeCurrentValue = function(newTargetValue,lerpValue) {

	this.targetValue = game.math.clamp(newTargetValue,0,this.maxValue);
	this.lerpValue = lerpValue || this.lerpValue;

};

G.ProgressBar.prototype.increaseCurrentValue = function(amount) {

	this.changeCurrentValue(this.targetValue+(amount || 1));

};

G.ProgressBar.prototype.decreaseCurrentValue = function(amount) {

	this.changeCurrentValue(this.targetValue-(amount || 1)); 

};

G.ProgressBar.prototype.changeValues = function(currentValue,maxValue) {

	this.currentValue = currentValue;
	this.prevCurrentValue = currentValue;
	this.targetValue = currentValue;
	this.maxValue = maxValue;

	if (this.label) {
		this.label.changeValues(currentValue,maxValue);
	}

	this.updateBarCrop();

};

G.ProgressBar.prototype.addLabel = function(labelType,animationOnIncrease) {

	this.label = new G.ProgressBar.Label(G.rl(this.width*0.5),G.rl(this.height*0.5),this.currentValue,this.maxValue,Math.floor(G.rl(this.height)*0.6),G.rl(this.width*0.7),labelType,animationOnIncrease);
	this.add(this.label);

};

//
// label types:
// 0 - current/max
// 1 - 20 left
//
G.ProgressBar.Label = function(x,y,currentValue,maxValue,size,maxWidth,labelType,animationOnIncrease) {

	G.OneLineText.call(this,x,y,'font','',size,maxWidth,0.5,0.5);

	this.labelType = labelType || 0;
	this.labelType1Text = G.txt('%AMOUNT% left');
	this.currentValue = currentValue;
	this.maxValue = maxValue;
	this.animationOnIncrease = animationOnIncrease || false;

	this.updateValue(this.currentValue,true);
};

G.ProgressBar.Label.prototype = Object.create(G.OneLineText.prototype);

G.ProgressBar.Label.prototype.updateValue = function(newCurrentValue,init) {

	if (!init && Math.min(newCurrentValue,this.maxValue) === this.currentValue) return;

	this.currentValue = newCurrentValue;

	this.updateLabelText();

	if (!init && this.animationOnIncrease) {
		G.stopTweens(this);
		this.scale.setTo(1);
		game.add.tween(this.scale).to({x:1.2,y:1.2},200,Phaser.Easing.Sinusoidal.InOut,true,0,0,true);
	}

};

G.ProgressBar.Label.prototype.changeValues = function(currentValue,maxValue) {

	this.currentValue = currentValue;
	this.maxValue = maxValue;
	this.alpha = this.currentValue < this.maxValue ? 1 : 0;
	this.updateLabelText();

};

G.ProgressBar.Label.prototype.updateLabelText = function() {

	if (this.labelType == 0) {
		this.setText(this.currentValue+'/'+this.maxValue);
	}else {
		this.setText(this.labelType1Text.replace('%AMOUNT%',(this.maxValue-this.currentValue)));
	}

};
if (typeof G == 'undefined') G = {};


G.SignalBox = (function() {

    //add permanents signal functionality
    if (!Phaser.Signal.prototype.addPermanent) {

        Phaser.Signal.prototype.addPermanent = function() {
            var signalBinding = this.add.apply(this,arguments);
            signalBinding._PERMANENT = true;
            return signalBinding;
        };

        Phaser.Signal.prototype.removeNonPermanent = function () {
            if (!this._bindings)
            {
                return;
            }

            var n = this._bindings.length;

            while (n--)
            {
                    if (!this._bindings[n]._PERMANENT)
                    {
                        this._bindings[n]._destroy();
                        this._bindings.splice(n, 1);
                    }
            }
        };
    };

    var clearOnStageChange = false;
    var signals = {};

    function clearNonPermanent() {
        Object.keys(signals).forEach(function(signal) {
            signals[signal].removeNonPermanent();
        });
    };

    function clearAll() {
        Object.keys(signals).forEach(function(signal) {
            signals[signal].removeAll();
        });
    };

    function getSignal(signalName) {

        if (!clearOnStageChange) {
            game.state.onStateChange.add(clearNonPermanent,this);
        }

        if (!signals[signalName]) {
            signals[signalName] = new Phaser.Signal();
        }

        return signals[signalName];

    };

    getSignal.signals = signals;
    getSignal.clearNonPermanent = clearNonPermanent;
    getSignal.clearAll = clearAll;

    return getSignal;



})();


G.Slider = function(x,y,width,initPos) {

	Phaser.Graphics.call(this,game,x,y);

	this.sliderWidth = width;
	this.pos = initPos;

	this.beginFill(0x000000,1);
	this.drawRect(0,-2,this.sliderWidth,4);

	this.circleGfx = this.addChild(game.make.graphics(width*initPos,0));
	this.circleGfx.clear();
	this.circleGfx.lineStyle(1, 0x000000, 1);
	this.circleGfx.beginFill(0x999999,1);
	this.circleGfx.drawCircle(0,0,32);
	this.circleGfx.sliderWidth = width;

	this.circleGfx.inputEnabled = true;
	this.circleGfx.input.useHandCursor = true;
	this.circleGfx.input.draggable = true;
	this.circleGfx.input.setDragLock(true, false);


};

G.Slider.prototype = Object.create(Phaser.Graphics.prototype);

G.Slider.prototype.update = function() {

	this.circleGfx.x = game.math.clamp(this.circleGfx.x,0,this.sliderWidth);
	this.pos = this.circleGfx.x/this.sliderWidth;

};
G.SliderPanel = function(x,y,width,height,content,config) {

	Phaser.Group.call(this,game);

	this.sliderWidth = G.l(width);
	this.sliderHeight = G.l(height);

	this.x = x + (this.sliderWidth*-0.5);
	this.y = y + (this.sliderHeight*-0.5);

	//slider mask
	this.gfxMask = game.add.graphics();
	
	this.gfxMask.beginFill(0x000000,1);
	this.gfxMask.drawRect(0,0,width,height);
	
	this.clickableObjects = [];

	this.config = config;
	this.applyConfig(this.config);

	this.addContent(content);
	this.add(this.gfxMask);
	//this.contentGroup.add(this.gfxMask);
	this.contentGroup.mask = this.gfxMask;

	this.slideY = 0;

	

	this.inputSprite = G.makeImage(0,0,null,0,this);
	this.inputSprite.inputEnabled = true;
	this.inputSprite.hitArea = new Phaser.Rectangle(0,0,width,height);

	this.inputSpriteDown = false;

	this.inputData = {
		x: null,
		y: null,
		velX: 0,
		velY: 0,
		xStart: null,
		yStart: null,
		startFrameStamp: null,
		clickDistanceWindow: 10,
		clickTimeWindow: 10,

	};

	//blocks input from buttons bellow
	this.inputSprite.events.onInputDown.add(function(pointer) {
		var p = game.input.activePointer;
		this.inputSpriteDown = true;
		this.inputData.x = this.inputData.xStart = p.worldX;
		this.inputData.y = this.inputData.yStart = p.worldY;
		this.inputData.startFrameStamp = this.frameCounter;
	},this);

	this.inputSprite.events.onInputUp.add(function() {
		var p = game.input.activePointer;
		this.inputSpriteDown = false;
		
		var distance = game.math.distance(this.inputData.xStart,this.inputData.yStart,p.worldX,p.worldY);
		var timeDelta = this.frameCounter - this.inputData.startFrameStamp;

		if (distance <= this.inputData.clickDistanceWindow && timeDelta <= this.inputData.clickTimeWindow) {
			this.propagateClick(p.x,p.y);
			this.inputData.velX = 0;
			this.inputData.velY = 0;
		}

	},this);

	//frameCounter for measuring click window
	//if I would use timestamps during low fps buttons could not work
	this.frameCounter = 0;

};

G.SliderPanel.prototype = Object.create(Phaser.Group.prototype);

G.SliderPanel.prototype.applyConfig = function(config) {

	this.horizontal = config.horizontal || false;
	this.horizontalLerp = config.horizontalLerp || false;
	this.vertical = config.vertical || true;
	this.verticalLerp = config.verticalLerp;

};

//group is at 0,0;
G.SliderPanel.prototype.addContent = function(group) {

	this.changeInputSettings(group);

	this.contentGroup = group;
	this.add(group);
	this.contentGroup.x = 0;

	this.contentGroupMinY = -this.contentGroup.height+this.sliderHeight;
	this.contentGroupMaxY = 0;
	this.contentGroupMinX = this.sliderWidth-this.contentGroup.width;
	this.contentGroupMaxX = 0;


};

//we have to change input settings, because buttons that are not visible
//are not covered by input sprite and they would be clickable
G.SliderPanel.prototype.changeInputSettings = function(group) {

	for (var i = group.children.length; i--; ) {
		var child = group.children[i];
		if (child.inputEnabled) {
			this.clickableObjects.push(child);
			child.inputEnabled = false;
		}
		if (child.children.length > 0) {
				this.changeInputSettings(child);
		}
	}

};

G.SliderPanel.prototype.update = function() {

	this.frameCounter++;

	if (this.inputSpriteDown && game.input.activePointer.isDown) {

		var difX = this.inputData.x - game.input.activePointer.worldX;
		var difY = this.inputData.y - game.input.activePointer.worldY;

		this.inputData.x = game.input.activePointer.worldX;
		this.inputData.y = game.input.activePointer.worldY;

		this.inputData.velX = 0.8 * (difX) + 0.2 * this.inputData.velX;
		this.inputData.velY = 0.8 * (difY) + 0.2 * this.inputData.velY;

		if (this.horizontal) {
			this.contentGroup.x -= this.inputData.velX;
		}

		if (this.vertical) {
			this.contentGroup.y -= this.inputData.velY;
		}

	}else {

		if (this.horizontal) {
			this.contentGroup.x -= this.inputData.velX;
			this.inputData.velX *= 0.95;
			if (Math.abs(this.inputData.velX) < 1) {
				this.inputData.velX = 0;
			}
		}

		if (this.vertical) {
			this.contentGroup.y -= this.inputData.velY;
			this.inputData.velY *= 0.95;
			if (Math.abs(this.inputData.velY) < 1) {
				this.inputData.velY = 0;
			}
		}
		
	}

	if (this.vertical) {
		this.boundRestrict('y',this.verticalLerp,this.contentGroupMinY,this.contentGroupMaxY);
	}

	if (this.horizontal) {
		this.boundRestrict('x',this.horizontalLerp,this.contentGroupMinX,this.contentGroupMaxX);
	}

	this.boundRestrict();
	

};

G.SliderPanel.prototype.propagateClick = function(pX,pY) {

	for (var i = 0; i < this.clickableObjects.length; i++) {
		if (this.clickableObjects[i].visible && this.clickableObjects[i].getBounds().contains(pX,pY)) {
			this.clickableObjects[i].onInputDown.dispatch();
			break;
		}
	}

};


G.SliderPanel.prototype.boundRestrict = function(prop,lerp,min,max) {

	if (lerp) {
		
		if (this.contentGroup[prop] > max) {
			this.contentGroup[prop] = G.lerp(this.contentGroup[prop],max,0.5);
			if (this.contentGroup[prop] < max+1 ) {
				this.contentGroup[prop] = max;
			}
		}

		if (this.contentGroup[prop] < min) {
			this.contentGroup[prop] = G.lerp(this.contentGroup[prop],min,0.2);
			if (this.contentGroup[prop] > min-1) {
				this.contentGroup[prop] = min;
			}
		}

	}else {

		this.contentGroup[prop] = game.math.clamp(this.contentGroup[prop],min,max);

	}

};
G.StrObjGroup = function(x,y,importObj){
	
	Phaser.Group.call(this,game);

	this.x = x || 0;
	this.y = y || 0;

	this.importObj = typeof importObj === 'string' ? JSON.parse(importObj) : importObj;

	this.parseImportObj(this.importObj);

};

G.StrObjGroup.prototype = Object.create(Phaser.Group.prototype);

G.StrObjGroup.prototype.parseImportObj = function(importObj){

	for (var i = 0; i < importObj.length; i++){

		var chunk = importObj[i];

		var img = G.makeImage(chunk.x,chunk.y,chunk.frame,chunk.anchor,this);
		img.scale.setTo(chunk.scale[0],chunk.scale[1]);
		img.angle = chunk.angle;

	}	

};
G.Text = function(x,y,txt,style,anchor,maxWidth,maxHeight,textWrap,align){

	if (typeof style !== 'object'){
		style = JSON.parse(JSON.stringify(G.Text.styles[style]));
	}

	this.userMaxWidth = maxWidth || Infinity;
	this.userMaxHeight = maxHeight || Infinity;

	if (textWrap){
		style.wordWrap = true;
		style.wordWrapWidth = maxWidth;
		style.align = align || 'left';
	}

	Phaser.Text.call(this,game,x,y,txt,style);

	if (anchor) {
    if (typeof anchor == 'number') { 
        this.anchor.setTo(anchor);
    }else {
        this.anchor.setTo(anchor[0],anchor[1]);
    }
  }

	this.width = Math.min(this.width,this.userMaxWidth);
	this.height = Math.min(this.height,this.userMaxHeight);

	

};

G.Text.prototype = Object.create(Phaser.Text.prototype);

G.Text.styles = {};

G.Text.addStyle = function(name,obj){
	G.Text.styles[name] = obj;
};

G.Text.prototype.setText = function(txt){

	Phaser.Text.prototype.setText.call(this,txt);
	this.scale.setTo(1);
	this.width = Math.min(this.width,this.userMaxWidth);
	this.height = Math.min(this.height,this.userMaxHeight);

};


G.TextCounter = function(x,y,amount,style,anchor,maxWidth,config){

	this.amount = amount;
	this.amountDisplayed = amount;

	G.Text.call(this,x,y,amount === null ? '...' : amount.toString(),style,anchor,maxWidth);

	config = config || {lerpValue: 0.5};

	//addConfig
	this.lerp = true;
	this.lerpValue = config.lerpValue;

	this.stepCurrent = 0;
	this.step = 0;

};

G.TextCounter.prototype = Object.create(G.Text.prototype);

G.TextCounter.prototype.setAmount = function(amount,immediately){

	this.amount = amount;
	if (immediately) {
		this.amountDisplayed = amount;
		this.setText(this.amountDisplayed.toString());
	}

};

G.TextCounter.prototype.changeAmount = function(change,immediately){

	this.amount += change;
	if (immediately) {
		this.amountDisplayed = this.amount;
		this.setText(this.amountDisplayed.toString());
	}

};

G.TextCounter.prototype.update = function(){

	if (this.amountDisplayed != this.amount && this.stepCurrent-- <= 0){
		this.stepCurrent = this.step;
		if (this.lerp) this.lerpUpdate();
	}

};

G.TextCounter.prototype.lerpUpdate = function(){

    this.amountDisplayed = (G.lerp(this.amountDisplayed,this.amount,this.lerpValue,0.2));
    this.setText(Math.round(this.amountDisplayed).toString());

};
G.TextRTCacher = function(){

};

G.TextRTCacher.prototype.cacheText = function(font,txt,fontSize,cacheLabel,tint){

	if (!this.txt){
		this.txt = game.make.bitmapText(0,0,font,'',80);
	}

	this.txt.fontSize = fontSize;
	this.txt.setText(txt);
	this.txt.tint = tint || 0xffffff;
	this.txt.updateCache();

	var rt = game.make.renderTexture(this.txt.width,this.txt.height,cacheLabel,true);
	rt.render(this.txt);

};

G.TextRTCacher.prototype.cachePhaserText = function(text,cacheLabel,style){

	var txt = game.make.text(0,0,text,style);
	var rt = game.make.renderTexture(txt.width,txt.height,cacheLabel,true);
	rt.render(txt);
	txt.destroy();

};
G.Timer = function(x,y,font,fontSize,maxWidth,anchorX,anchorY) {
	
	G.OneLineText.call(this,x,y,font,'???',fontSize,maxWidth,anchorX,anchorY);

	this.secLeft = 0;
	this.active = false;

	this.timerBinding = G.sb.onWallClockTimeUpdate.add(this.updateTimer,this);

	this.events.onDestroy.add(function() {
		this.timerBinding.detach();
	},this);

}

G.Timer.prototype = Object.create(G.OneLineText.prototype);


G.Timer.prototype.updateTimer = function() {

	if (!this.active) return;

	G.sfx.clock_tick.play();

	this.secLeft = Math.max(0,this.secLeft-1);
	this.setText(G.changeSecToTimerFormat(this.secLeft));

};

G.Timer.prototype.setSecLeft = function(secLeft) {

	this.secLeft = secLeft;
	this.setText(G.changeSecToTimerFormat(this.secLeft));

};

G.Timer.prototype.start = function(secLeft) {

	this.active = true;

};

G.TimerT = function(x,y,date,style,anchor,maxWidth,timerFormat,sfx) {
	
	G.Text.call(this,x,y,'???',style,anchor,maxWidth);

	this.secLeft = 0;
	this.active = false;
	this.timerFormat = timerFormat;

	this.dots = true;

	this.sfx = sfx ? G.sfx[sfs] : null;

	this.timerBinding = G.sb('onWallClockTimeUpdate').add(this.updateTimer,this);

	this.events.onDestroy.add(function() {
		this.timerBinding.detach();
	},this);

	if (date){
		this.setDate(date);
	}

}

G.TimerT.prototype = Object.create(G.Text.prototype);


G.TimerT.prototype.updateTimer = function() {

	if (!this.active) return;

	if (this.sfx) this.sfx.play();
	
	this.secLeft = Math.max(0,this.secLeft-1);

	this.updateTimerText(this.secLeft,this.dots);

	this.dots = !this.dots;

	// var dataArray = G.changeSecToDHMS(this.secLeft);

	// this.setText(G.changeSecToTimerFormat(this.secLeft));

};

G.TimerT.prototype.setSecLeft = function(secLeft) {

	this.secLeft = Math.max(0,secLeft);
	this.updateTimerText(this.secLeft,true);

};

G.TimerT.prototype.updateTimerText = function(secLeft,dots){

	var dataArray = G.changeSecToDHMS(this.secLeft);

	var txt = [];

	if (this.timerFormat.indexOf('d') > -1){
		txt.push(dataArray[0]);
	}

	if (this.timerFormat.indexOf('h') > -1){
		txt.push(dataArray[1]);
	}

	if (this.timerFormat.indexOf('m') > -1){
		txt.push(dataArray[2]);
	}

	if (this.timerFormat.indexOf('s') > -1){
		txt.push(dataArray[3]);
	}

	this.setText(txt.join(dots ? ':' : ' '));

};

G.TimerT.prototype.start = function(secLeft) {

	this.active = true;

};

G.TimerT.prototype.setDate = function(dateString){

	var ms = new Date(dateString).getTime();
	var now = Date.now();
	var diffSec = Math.ceil((ms-now)/1000);
	this.setSecLeft(diffSec);
	this.active = true;

};

G.UITargetParticles = function() {
	
	G.PoolGroup.call(this,G.UITargetParticle);
	this.fixedToCamera = true;

}

G.UITargetParticles.prototype = Object.create(G.PoolGroup.prototype);

G.UITargetParticles.prototype.initPart = function(x,y,sprite,targetObj,carriedValue,start){

	var part = this.init(x,y,sprite,targetObj,carriedValue);
	return part;
};


G.UITargetParticles.prototype.createDividedBatch = function(x,y,sprite,targetObj,amount,interval) {

	var batchObj = new G.UITargetParticles.BatchObj();

	var maxPartNr = maxPartNr || 25;
	var partNr = (amount/interval);
	if (partNr > maxPartNr){
		interval = Math.ceil(amount/maxPartNr);
	}

	var nrOfPartsInBatch = Math.floor(amount/interval)+Math.sign(amount % interval);

	for (var i = 0; i < nrOfPartsInBatch; i++) {
		var part = this.init(x,y,sprite,targetObj,Math.min(interval,amount));
		amount -= interval;
		batchObj.add(part);
	}

	return batchObj;

};

G.UITargetParticles.prototype.createBatch = function(x,y,sprite,targetObj,carriedValue,nrOfParts) {

	var batchObj = new G.UITargetParticles.BatchObj();

	var array = Array.isArray(x);

	for (var i = 0; i < nrOfParts; i++) {
		if (array){
			var part = this.init(x[i].x,x[i].y,sprite,targetObj,carriedValue);
		}else{
			var part = this.init(x,y,sprite,targetObj,carriedValue);
		}

		batchObj.add(part);
	}

	return batchObj;

};

G.UITargetParticles.BatchObj = function() {

	this.parts = [];
	this.nrOfParts = 0;
	this.nrOfFinished = 0;
	this.onFinish = new Phaser.Signal();

};

G.UITargetParticles.BatchObj.prototype.add = function(part) {

	this.parts.push(part);
	part.onFinish.addOnce(this.onPartFinish,this);
	this.nrOfParts++;

};

G.UITargetParticles.BatchObj.prototype.onPartFinish = function() {
	this.nrOfFinished++;
	if (this.nrOfFinished == this.nrOfParts) {
		this.onFinish.dispatch();
	}
};

G.UITargetParticles.BatchObj.prototype.addOnPartStart = function(func,context) {

	this.parts.forEach(function(part) {
		part.onStart.addOnce(func,context || part,1);
	});
	
};

G.UITargetParticles.BatchObj.prototype.addOnPartFinish = function(func,context) {
	
	this.parts.forEach(function(part) {
		part.onFinish.addOnce(func,context || part,1);
	});

};

G.UITargetParticles.BatchObj.prototype.start = function(delayBetween) {

	var delay = 0;
	this.parts.forEach(function(part) {
		part.start(delay);
		delay += delayBetween || 0;
	})

};





G.UITargetParticle = function() {

	G.Image.call(this,0,0,null,0.5);
	this.onStart = new Phaser.Signal();
	this.onFinish = new Phaser.Signal();
	
	this.speed = 0;
	this.speedMax = 30;
	this.speedDelta = 0.75;

	

	this.vel = new Phaser.Point(0,0);
	this.velInit = new Phaser.Point(0,0);

	this.kill();

};

G.UITargetParticle.prototype = Object.create(G.Image.prototype);

G.UITargetParticle.prototype.init = function(x,y,sprite,targetObj,carriedValue) {

	this.position.setTo(x,y);
	
	this.changeTexture(sprite);

	this.onStart.removeAll();
	this.onFinish.removeAll();

	this.carriedValue = carriedValue || 1;

	this.targetObj = targetObj;


	this.stopTweens(this);
	this.scale.setTo(1);
	this.alpha = 1;

	this.speed = 0;

	this.vel.setTo(0,0);

};

G.UITargetParticle.prototype.start = function(delay) {

	if (delay) {
		game.time.events.add(delay,this.start,this);
		return;
	}
	
	this.revive();
	
	this.onStart.dispatch(this,this.carriedValue);

};

G.UITargetParticle.prototype.update = function() {

	if (!this.alive) return;

	this.position.add(this.vel.x,this.vel.y);
	this.vel.x *= 0.95;
	this.vel.y *= 0.95;

	this.speed += this.speedDelta;
	this.speed = Math.min(this.speed,this.speedMax);

	var distanceToTarget = Phaser.Point.distance(this.worldPosition,this.targetObj.worldPosition);
	var angleToTarget = Phaser.Point.angle(this.targetObj.worldPosition,this.worldPosition);
	this.position.add( 
		G.lengthDirX(angleToTarget,Math.min(distanceToTarget,this.speed),true),
		G.lengthDirY(angleToTarget,Math.min(distanceToTarget,this.speed),true)
	);

	if (distanceToTarget < this.speedMax * 1.2) {
		this.onFinish.dispatch(this,this.carriedValue);
		this.kill();
	};

};
if (typeof G == 'undefined') G = {};

Math.sign = Math.sign || function(x) {
  x = +x; // convert to a number
  if (x === 0 || isNaN(x)) {
    return x;
  }
  return x > 0 ? 1 : -1;
}


G.isImageInCache = function(frameName) {

  var spritesheet = this.checkSheet(frameName)
  if (spritesheet != '') {
    return true;
  }else {
    return game.cache.checkImageKey(frameName);
  }

};


G.checkSheet = function(frame) {
  
  if (G.spritesheetMap) {
    return G.spritesheetMap[frame] || '';
  }else {
    return this.checkSheetOld();
  }

 
};

G.checkSheetOld = function() {
  for (var i = 0, len = G.ASSETS.spritesheets.length; i < len; i++) {
    var spritesheet = G.ASSETS.spritesheets[i];
      if (game.cache.checkImageKey(G.ASSETS.spritesheets[i]) && game.cache.getFrameData(G.ASSETS.spritesheets[i]).getFrameByName(frame)) {
          return G.ASSETS.spritesheets[i];
      }
  }
  return '';
};

G.lerp = function(valCurrent,valTarget,lerp,snapRange) {

  if (snapRange && Math.abs(valCurrent-valTarget) <= snapRange) {
    return valTarget;
  }

  return valCurrent+lerp*(valTarget-valCurrent);
};

G.l = function(value) {
  return Math.floor(value*G.Loader.currentConfigMulti); 
};

G.rl = function(value) {

  return Math.floor(value*(1/G.Loader.currentConfigMulti));  

};

G.lnf = function(value) {
  return value*G.Loader.currentConfigMulti; 
};

G.rnd = function(min,max) {
  return game.rnd.realInRange(min || 0,max || 1);
};

G.rndInt = function(min,max) {
  return game.rnd.between(min,max);
};

G.changeTexture = function(obj,image) {

  if (typeof image !== 'string'){
    //probalby texture file
    return obj.loadTexture(image);
  }

  var ssheet = this.checkSheet(image);

  if (ssheet == '') {
    obj.loadTexture(image);
  }else {
    obj.loadTexture(ssheet,image);
  };

};

G.txt = function(text) {

  if (!G.lang) G.lang = 'en';
  if (!G.json.languages[G.lang]) G.lang = 'en';
  return G.json.languages[G.lang][text] || text+'***';

};

G.deltaTime = 1;

G.delta = function() {

  G.deltaTime = Math.min(1.5,game.time.elapsedMS/16);
  if (game.time.elapsedMS == 17) G.deltaTime = 1;
};

G.rotatePositions = function(positions) {

  var result = [];

  for (var i = 0, len = positions.length; i < len; i+=2) {
    result.push(
      positions[i+1]*-1,
      positions[i]
    )
  }

  return result;

};

G.loadTexture = G.changeTexture;

G.makeImage = function(x,y,frame,anchor,groupToAdd) {
    
  var ssheet = this.checkSheet(frame);
  var image;

  if (ssheet == '') {
    image = game.make.image(this.l(x),this.l(y),frame);
  } else {
    image = game.make.image(this.l(x),this.l(y),ssheet,frame);
  }

  if (anchor) {
    if (typeof anchor == 'number') {
        image.anchor.setTo(anchor);
    }else {
        image.anchor.setTo(anchor[0],anchor[1]);
    }
  }

  if (groupToAdd) {
    (groupToAdd.add || groupToAdd.addChild).call(groupToAdd,image);
  }else if (groupToAdd !== null) {
    game.world.add(image);
  }

  return image;
};

G.capitalize = function(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

G.lengthDirX =  function(angle, length, rads) {
  var rads = rads || false;
  if (rads) {
    return Math.cos(angle) * length;
  }else {
    return Math.cos(game.math.degToRad(angle)) * length;
  }
};

G.lengthDirY = function(angle, length, rads) {
  var rads = rads || false;
  if (rads) {
    return Math.sin(angle) * length;
  }else {
    return Math.sin(game.math.degToRad(angle)) * length;
  }
};


G.stopTweens = function(obj) {

    game.tweens._add.forEach(function(tween) {
        if (obj.scale && tween.target == obj.scale) tween.stop();
        if (tween.target == obj) tween.stop();
    });

    game.tweens._tweens.forEach(function(tween) {
        if (obj.scale && tween.target == obj.scale) tween.stop();
        if (tween.target == obj) tween.stop();
    });
};


G.makeExtImage = function(x,y,url,waitImg,anchor,groupToAdd,tmp,func) {

  if (!G.extLoader) G.extLoader = new G.ExtLoader(game);

  var img;

  if (G.extLoader.loadedUrls[url]) {
    img = G.makeImage(x,y,G.extLoader.loadedUrls[url],anchor,groupToAdd);
    func.call(img);
    return img;
  }

  img = G.makeImage(x,y,waitImg,anchor,groupToAdd);
  img.onImgLoaded = new Phaser.Signal();
  
  if (!G.extImagesKeys) G.extImagesKeys = [];
  var name = 'extImgBlankName'+G.extImagesKeys.length;

  G.extImagesKeys.push(name);

  var binding = G.extLoader.onFileComplete.add(function(progress,key,success) {

    if (key == name && success) {

      G.extLoader.loadedUrls[url] = name;

      G.changeTexture(img,name);
      if (func) func.call(img);
      binding.detach();
    }
    
  });
  //game.load.start();

  G.extLoader.image(name, url, true);

  /*if (tmp) {
    G.extLoader.imagesToRemoveOnStateChange.push(name);
  }*/

  return img;

};


G.drawCircleSegment = function(gfx,x,y,radius,angleStart,angleFinish,segments) {

  if (angleStart === angleFinish)
  {
      return gfx;
  }

  if (segments === undefined) {segments = 10};

  var angleDiff = angleFinish-angleStart;
  var segDiff = angleDiff/segments;

  gfx.moveTo(x,y);
  var points = gfx.currentPath.shape.points;

  for ( ; angleStart <= angleFinish; angleStart+=segDiff) {
    points.push(
      Math.floor(x + G.lengthDirX(angleStart,radius,false)),
      Math.floor(y + G.lengthDirY(angleStart,radius,false))
    )
  };

  points.push(
      Math.floor(x + G.lengthDirX(angleFinish,radius,false)),
      Math.floor(y + G.lengthDirY(angleFinish,radius,false))
    )


  gfx.dirty = true;
  gfx._boundsDirty = true;

  return gfx;


};

G.centerElements = function(list,distanceList,center) {

  if (center === undefined) center = 0;
  if (distanceList === undefined) distanceList=[];

  var wholeWidth = 0;
  var isDistArray = Array.isArray(distanceList);

  list.forEach(function(e,i) {
    wholeWidth += e.width;
    if (isDistArray ? distanceList[i-1] : distanceList !== undefined) {
      wholeWidth+=G.l(isDistArray ? distanceList[i-1] : distanceList);
    }
  });

  var currentX = center + (wholeWidth*-0.5);

  list.forEach(function(e,i,a) {
    e.x = currentX;
    e.x += e.width*e.anchor.x;    

    currentX += e.width;
    if (isDistArray ? distanceList[i-1] : distanceList  !== undefined) {
      currentX += G.l(isDistArray ? distanceList[i] : distanceList);
    }
  });

};

G.centerElements2 = function(list,distance,center){

  if (center === undefined) center = 0;
  if (distance === undefined) distance = 0;

  var wholeWidth = 0;

  list.forEach(function(e,i){
    wholeWidth += e.width;
  });

  wholeWidth += distance * (list.length-1);

  list.forEach(function(e,i,l){
    if (i == 0){
      e.left = center+(wholeWidth*-0.5);
    }else{
      e.left = l[i-1].right + distance;
    }
  });

};


G.makeMover = function(obj) {

  if (G.activeMover !== undefined) {
    G.activeMover.destroy();
      G.activeMover.eKey.onDown.removeAll();
  }

  G.activeMover = game.add.image();
  G.activeMover.obj = obj;
  G.activeMover.cursors = game.input.keyboard.createCursorKeys();
  G.activeMover.shiftKey = game.input.keyboard.addKey(Phaser.Keyboard.SHIFT);
  G.activeMover.eKey = game.input.keyboard.addKey(Phaser.Keyboard.E);
  G.activeMover.eKey.onDown.add(function() {
      console.log("MOVER: "+this.obj.x+'x'+this.obj.y);
  },G.activeMover)

  G.activeMover.update= function() {

      var moveVal = this.shiftKey.isDown ? 10 : 2;

      if (this.cursors.down.isDown) {
        obj.y += moveVal;
      }   

       if (this.cursors.up.isDown) {
        obj.y -= moveVal;
      }

       if (this.cursors.left.isDown) {
        obj.x -= moveVal;
      }

       if (this.cursors.right.isDown) {
        obj.x += moveVal;
      }

  };

};


G.makeLineEditor = function(interpolation) {

  var be = game.add.group();

  be.interpolation = interpolation || 'linear';
  be.pointsX = [0];
  be.pointsY = [0];



  be.gfx = be.add(game.make.graphics());

  be.shiftKey = game.input.keyboard.addKey(Phaser.Keyboard.SHIFT);

  be.wKey = game.input.keyboard.addKey(Phaser.Keyboard.W);
  be.wKey.onDown.add(function(){

    var xx,yy;

    if (this.children.length > 2) {
      xx = this.children[this.children.length-1].x;
      yy = this.children[this.children.length-1].y;
    }else {
      xx = 0;
      yy = 0;
    }

    var newPoint  = G.makeImage(xx,yy,'candy_1');
    newPoint.anchor.setTo(0.5);
    newPoint.scale.setTo(0.1);
    this.add(newPoint);
    this.activeObject = newPoint;
    this.changed = true;
  },be);

  be.qKey = game.input.keyboard.addKey(Phaser.Keyboard.Q);
  be.qKey.onDown.add(function() {
    if (this.children.length <= 2) return;
    this.removeChildAt(this.children.length-1);
    if (this.children.length > 3) {
      this.activeObject = this.children[this.children.length-1];
    }else {
      this.activeObject = null;
    }
    this.changed = true;
  },be);


  be.aKey = game.input.keyboard.addKey(Phaser.Keyboard.A);
  be.aKey.onDown.add(function() {
    if (!this.activeObject) return;
    var index = this.getChildIndex(this.activeObject);
    if (index == 2) return;
    this.activeObject = this.getChildAt(index-1);
  },be);

  be.sKey = game.input.keyboard.addKey(Phaser.Keyboard.S);
  be.sKey.onDown.add(function() {
    if (!this.activeObject) return;
    var index = this.getChildIndex(this.activeObject);
    if (index == this.children.length-1) return;
    this.activeObject = this.getChildAt(index+1);
  },be);

  be.eKey = game.input.keyboard.addKey(Phaser.Keyboard.E);
  be.eKey.onDown.add(function() {
    console.log(JSON.stringify([this.pointsX,this.pointsY]));
  },be);


  be.cursors = game.input.keyboard.createCursorKeys();

  be.activeObject = null;

  be.preview = G.makeImage(0,0,'candy_2',0.5,be);
  be.preview.width = 8;
  be.preview.height = 8;
  be.preview.progress = 0;

  be.update = function() {

    if (this.activeObject === null) return;

    this.forEach(function(e) {
      if (e == this.activeObject) {
        e.alpha = 1;
      }else {
        e.alpha = 0.5;
      }
    },this)

    if (this.children.length == 0) return;

    var moveVal = this.shiftKey.isDown ? 3 : 1;

    if (this.cursors.down.isDown) {
      this.activeObject.y += moveVal;
      this.changed = true;
    }
    if (this.cursors.up.isDown) {
      this.activeObject.y -= moveVal;
      this.changed = true;
    }
    if (this.cursors.left.isDown) {
      this.activeObject.x -= moveVal;
      this.changed = true;
    }
    if (this.cursors.right.isDown) {
      this.activeObject.x += moveVal;
      this.changed = true;
    }


    be.preview.progress += 0.01;
    if (be.preview.progress > 1) be.preview.progress = 0;
    be.preview.x = game.math[this.interpolation+'Interpolation'](this.pointsX,be.preview.progress);
    be.preview.y = game.math[this.interpolation+'Interpolation'](this.pointsY,be.preview.progress);


    if (this.changed) {
      var pointsX = [];
      var pointsY = [];
      this.pointsX = pointsX;
      this.pointsY = pointsY;
      this.children.forEach(function(e,index) {
        if (index <= 1) return;
        pointsX.push(e.x);
        pointsY.push(e.y);
      });

      this.gfx.clear();
      this.gfx.beginFill(0xff0000,1);
      for (var i = 0; i < 200; i++) {
        this.gfx.drawRect(
          game.math[this.interpolation+'Interpolation'](pointsX,i/200),
          game.math[this.interpolation+'Interpolation'](pointsY,i/200),
          3,3
        );
      }
    }
  }


  return be;

};


G.lineUtils = {

  getWholeDistance: function(pointsX,pointsY){

    var wholeDistance = 0;
    for (var i  = 1; i < pointsX.length; i++) {
      wholeDistance += game.math.distance(pointsX[i-1],pointsY[i-1],pointsX[i],pointsY[i]);
    }
    return wholeDistance;

  },

  findPointAtDitance: function(pointsX,pointsY,dist) {

    var soFar = 0;
    for (var i = 1; i < pointsX.length; i++) {
      var currentDistance = game.math.distance(pointsX[i-1],pointsY[i-1],pointsX[i],pointsY[i]);
      if (currentDistance+soFar > dist) {
        var angle = game.math.angleBetween(pointsX[i-1],pointsY[i-1],pointsX[i],pointsY[i]);
        return [
          pointsX[i-1]+G.lengthDirX(angle,dist-soFar,true),
          pointsY[i-1]+G.lengthDirY(angle,dist-soFar,true)
        ]
      }else {
        soFar += currentDistance;
      } 

    }
    return [pointsX[pointsX.length-1],pointsY[pointsY.length-1]];

  },

  spreadAcrossLine: function(pointsX,pointsY,elementsList,propName1,propName2) {

     console.log("spreadAcrossLine");

    var wholeDistance = this.getWholeDistance(pointsX,pointsY);
    var every = wholeDistance/(elementsList.length-1);

    for (var i = 0; i < elementsList.length; i++) {
      var point = this.findPointAtDitance(pointsX,pointsY,every*i);
      elementsList[i][propName1 || 'x'] = point[0];
      elementsList[i][propName2 || 'y'] = point[1];   
    }
 
  },

  spreadOnNodes: function(pointsX,pointsY,elementsList,propName1,propName2) {

    console.log("SPREAD ON NODES");
    console.log(arguments);

    for (var i = 0; i < pointsX.length; i++) {
      console.log(i);
      if (typeof elementsList[i] === 'undefined') return;
      elementsList[i][propName1 || 'x'] = pointsX[i];
      elementsList[i][propName2 || 'y'] = pointsY[i]; 
      console.log(i + ' pos: '+pointsX[i]+'x'+pointsY[i]);     
    }

  }
};



G.changeSecToTimerFormat = function(sec,forceFormat) {

    var sec_num = parseInt(sec, 10); // don't forget the second param

    var fD = forceFormat ? forceFormat.toUpperCase().indexOf('D') !== -1 : false;
    var fH = forceFormat ? forceFormat.toUpperCase().indexOf('H') !== -1 : false;

    var days = Math.floor(sec_num / 86400);
    var hours   = Math.floor((sec_num - (days * 86400)) / 3600);
    var minutes = Math.floor((sec_num - (days * 86400) - (hours * 3600)) / 60);
    var seconds = sec_num - (days * 86400) - (hours * 3600) - (minutes * 60);


    var result = G.zeroPad(minutes)+':'+G.zeroPad(seconds);

    if (hours > 0 || days > 0 || fH){
      result = G.zeroPad(hours)+':'+result;
    }

    if (days > 0 || fD){
      result = G.zeroPad(days)+':'+result;
    }

    return result;

};

G.changeSecToDHMS = function(sec,forceFormat) {

    var sec_num = parseInt(sec, 10); // don't forget the second param

    var fD = forceFormat ? forceFormat.toUpperCase().indexOf('D') !== -1 : false;
    var fH = forceFormat ? forceFormat.toUpperCase().indexOf('H') !== -1 : false;

    var days = Math.floor(sec_num / 86400);
    var hours   = Math.floor((sec_num - (days * 86400)) / 3600);
    var minutes = Math.floor((sec_num - (days * 86400) - (hours * 3600)) / 60);
    var seconds = sec_num - (days * 86400) - (hours * 3600) - (minutes * 60);

    return [G.zeroPad(days),G.zeroPad(hours),G.zeroPad(minutes),G.zeroPad(seconds)];

};


G.zeroPad = function(number){
  return number < 10 ? "0" + number : number;
};

G.arrayJoin = function(array,marker) {

  return array.reduce(function(accumulator,currentVal) {

    if (currentVal) {

      if (accumulator) {
         return accumulator+marker+currentVal;
      }else {
         return currentVal;
      }

     
    }else {
      return accumulator;
    } 

  },'');


};

G.makeTextButton = function(x,y,text,style,func,context) {

  var txt = game.make.text(x,y,text,style)
  txt.inputEnabled = true;
  txt.input.useHandCursor = true;
  txt.hitArea = new Phaser.Rectangle(0,0,txt.width,txt.height);
  txt.events.onInputDown.add(func,context || null);

  return txt;

};

G.setObjProp = function(obj,prop,val){

  var currentObj = obj;
  if (typeof prop == 'string') {
    prop.split('.');
  }

  try {
    for (var i = 0; i < this.refreshProp.length-1; i++){
      currentObj = currentObj[this.refreshProp[i]];
    } 

    currentObj[this.refreshProp[this.refreshProp.length-1]] = val;
  }catch(e){
    console.warn('cant set prop');
    console.log(obj);
    console.log(prop);
  }


};

G.getObjProp = function(obj,prop){

  var current = obj;
    if (typeof prop == 'string') {
      prop = prop.split('.');
    }

    try {
      for (var i = 0; i < prop.length; i++){
        current = current[prop[i]];
      }
    } catch(e){
      return undefined;
    }

    return current;

};



if (typeof G == 'undefined') G = {};

G.Utils = {

  cacheText: function(cacheLabel,txt,font,fontSize,tint){

    var txt = game.make.bitmapText(0,0,font,txt,fontSize);
    txt.tint = tint || 0xffffff;
    txt.updateCache();

    var rt = game.make.renderTexture(txt.width,txt.height,cacheLabel,true);
    rt.render(txt);

    txt.destroy();

  },

  cacheGText: function(cacheLabel,txt,style){

    var txt = new G.Text(0,0,txt,style,0);
    var rt = game.make.renderTexture(txt.width,txt.height,cacheLabel,true);
    rt.render(txt);
    txt.destroy();

  },
  
  lerp: function(valCurrent,valTarget,lerp,snapRange) {
    if (snapRange && Math.abs(valCurrent-valTarget) <= snapRange) {
      return valTarget;
    }
    return valCurrent+lerp*(valTarget-valCurrent);
  },
  
  copyToClipboard: function(text){

    if (!this.copyArea) {
      this.copyArea = document.createElement("textarea");
      this.copyArea.style.positon = 'fixed';
      this.copyArea.style.opacity = 0;
      document.body.appendChild(this.copyArea);

    }

    this.copyArea.value = text;
    this.copyArea.select();
    document.execCommand('copy');

  },

  getObjProp: function(obj,prop){

    var current = obj;
    if (typeof prop == 'string') {
      prop = prop.split('.');
    }

    try {
      for (var i = 0; i < prop.length; i++){
        current = current[prop[i]];
      }
    } catch(e){
      return undefined;
    }

    return current;

  },

  setObjProp: function(obj,prop,val){

    var currentObj = obj;
    if (typeof prop == 'string') {
      prop = prop.split('.');
    }

    try {
      for (var i = 0; i < prop.length-1; i++){
        currentObj = currentObj[prop[i]];
      } 
      currentObj[prop[prop.length-1]] = val;
    }catch(e){
      return null;
    }

  },

  replaceAll: function(string,search,replacement){
    return string.split(search).join(replacement);
  },

  removeDuplicates: function(array){

    var result = [];

    array.forEach(function(elem){
      if (result.indexOf(elem) === -1) result.push(elem);
    });

    return result;
    
  },

  getParentsScaleX: function(obj,rec){

    if (obj == game.stage){
      return 1;
    }else{
      return G.Utils.getParentsScaleX(obj.parent,true)*(!rec ? 1 : obj.scale.x);
    }

  },

  getParentsScaleY: function(obj,rec){

    if (obj == game.stage){
      return 1;
    }else{
      return G.Utils.getParentsScaleY(obj.parent,true)*(!rec ? 1 : obj.scale.y);
    }

  },

  makeTextButton: function(x,y,label,func,context,style) {

    var txt = game.add.text(x,y,label,style);
    txt.inputEnabled = true;
    txt.input.useHandCursor = true;
    txt.hitArea = new Phaser.Rectangle(0,0,txt.width,txt.height);
    txt.events.onInputDown.add(func,context);
    return txt;

  },

  injectCSS: function(css){

    var style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = css;
    document.getElementsByTagName('head')[0].appendChild(style);

  },

  toClientX: function(ingameX){
    var marginLeft = parseInt(game.canvas.style.marginLeft) || 0;
    return marginLeft+(ingameX/game.width)*game.canvas.clientWidth;
  },

  toClientY: function(ingameY){
    var marginTop = parseInt(game.canvas.style.marginTop) || 0;
    return marginTop+(ingameY/game.height)*game.canvas.clientHeight;
  },

  clientXToWorldX: function(clientX){
    var marginLeft = parseInt(game.canvas.style.marginLeft) || 0;

    clientX -= marginLeft;
    var canvasStyleWidth = parseInt(game.canvas.style.width);
    var canvasStyleHeight = parseInt(game.canvas.style.height);
    var canvasContextWidth = parseInt(game.canvas.width);
    var canvasContextHeight = parseInt(game.canvas.height);

    var ratio = canvasContextWidth/canvasStyleWidth;

    return clientX*ratio;


  },

  clientYToWorldY: function(clientY){

    var marginTop = parseInt(game.canvas.style.marginTop) || 0;

    clientY -= marginTop;
    var canvasStyleWidth = parseInt(game.canvas.style.width);
    var canvasStyleHeight = parseInt(game.canvas.style.height);
    var canvasContextWidth = parseInt(game.canvas.width);
    var canvasContextHeight = parseInt(game.canvas.height);

    var ratio = canvasContextHeight/canvasStyleHeight;

    return clientY*ratio;

  },

  

  getImageURI: function(img){

    if (!this._bmpMarker) this._bmpMarker = G.makeImage(0,0,null,0,null);
    if (!this._bmp) this._bmp = game.make.bitmapData();

    this._bmp.clear();
    G.changeTexture(this._bmpMarker,img);
    this._bmp.resize(this._bmpMarker.width,this._bmpMarker.height);
    this._bmp.draw(this._bmpMarker);
    return this._bmp.canvas.toDataURL();
  },

  getRT: function(rtName){
    return game.cache.getRenderTexture(rtName).texture;
  },

  arraysEqual: function arraysEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length != b.length) return false;

    // If you don't care about the order of the elements inside
    // the array, you should sort both arrays here.

    for (var i = 0; i < a.length; ++i) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

};

G.lineCircleColl = function(LINE,C,point) {

  var A = LINE.start;
  var B = LINE.end;

  var LAB = Math.sqrt(Math.pow(B.x-A.x,2)+Math.pow(B.y-A.y,2))

  var Dx = (B.x-A.x)/LAB
  var Dy = (B.y-A.y)/LAB

  var t = Dx*(C.x-A.x) + Dy*(C.y-A.y)    

  var Ex = t*Dx+A.x
  var Ey = t*Dy+A.y

  var LEC = Math.sqrt(Math.pow(Ex-C.x,2)+Math.pow(Ey-C.y,2))

  if( LEC < C.radius )
  {
      
      var dt = Math.sqrt((C.radius*C.radius) - (LEC*LEC))

      var Fx = (t-dt)*Dx + A.x;
      var Fy = (t-dt)*Dy + A.y;

      var Gx = (t+dt)*Dx + A.x;
      var Gy = (t+dt)*Dy + A.y;

      var FtoLength = game.math.distance(A.x,A.y,Fx,Fy);
      var GtoLength = game.math.distance(A.x,A.y,Gx,Gy);

      if (FtoLength < GtoLength) {
        if (LINE.length > FtoLength) {
          point.setTo(Fx,Fy);
          return point;
        }else {
          return false;
        }
      }else {
        if (LINE.length > GtoLength) {
          point.setTo(Gx,Gy);
          return point;
        }else {
          return false;
        }
      }

  } else {
    return false;
  }

};

G.getRT = function(rtName){

  var rt = game.cache.getRenderTexture(rtName);
  if (!rt) return null;
  return rt.texture;
};


G.numberDot = function(price){

  price = price.toString();
  var result = '';

  var n = 0;
  for (var i = price.length-1; i >= 0; i--){
    result = price[i] + result;
    n++;
    if (n == 3 && i !== 0){
      result = '.' + result;
      n = 0;
    }
  }

  return result;

};


G.guid = function() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
};
G.AnimationElement = function(x,y,data,autoplay){

	G.Image.call(this,x,y,null);

	this.ANIMATIONELEMENT = true;

	//we need to have this element, so constructor act as wrapper
	//so it can be placed, rotated and scaled without affecting
	//values on timelines
	this.SPR = new G.Image(0,0,null,0.5,this); 

	this.frameCounter = 0;
	this.data = data;

	this.currentAnimationData = null;
	this.currentAnimationName = null;

	this.playing = autoplay === undefined ? true : autoplay;

};

G.AnimationElement.prototype = Object.create(G.Image.prototype);

G.AnimationElement.prototype.update = function(){

	if (!this.currentAnimationName) return;

	if (this.playing){
		this.frameCounter++;
		this.updateAnimation(this.frameCounter);
	}
	
};

G.AnimationElement.prototype.pause = function(){
	this.playing = false;
};

G.AnimationElement.prototype.resume = function(){
	this.playing = true;
};

G.AnimationElement.prototype.play = function(){
	this.playing = true;
};

G.AnimationElement.prototype.stop = function(){
	this.playing = false;
	this.updateAnimation(0);
};

/*G.AnimationElement.prototype.getTotalLength = function(){

	var len = Infinity;

	for (var i = 0; i < this.propKeys.length; i++){
		len = Math.min(
			this.propTLS[this.propKeys[0]].length,
			len
		);
	}

	len = Math.min(this.eventTL.length,len);

	return len;

};*/

/*
G.AnimationElement.prototype.init = function(dataInit){

	this.SPR.x = dataInit.x;
	this.SPR.y = dataInit.y;
	this.SPR.angle = dataInit.angle;
	this.SPR.scale.setTo(dataInit.scale[0],dataInit.scale[1]);
	this.SPR.changeTexture(dataInit.frame);
	this.SPR.anchor.setTo(dataInit.anchor[0],dataInit.anchor[1]);

};*/

var testObj = {
	normal: {
		eventTL: [],
		frameTL: [{f:0, v:'candy_1'}],
		propTLS: {
			alpha: [{f:0,v:1}],
			x: [{f:0,v:0}],
			y: [{f:0,v:0}],
			angle: [{f:0,v:0}],
			'scale.x': [{f:0,v:1}],
			'scale.y': [{f:0,v:1}],
			'anchor.x':  [{f:0,v:0.5}],
			'anchor.y':  [{f:0,v:1}]
		}
	},
	jump: {
		eventTL: [],
		frameTL: [{f:0, v:null}],
		propTLS: {
			alpha: [{f:0,v:1}],
			x: [{f:0,v:0}],
			y: [{f:0,v:0},{f:120,v:-300}],
			angle: [{f:0,v:0,e:['Linear','None']},{f:400,v:360}],
			'scale.x': [{f:0,v:1}],
			'scale.y': [{f:0,v:1}],
			'anchor.x':  [{f:0,v:0.5}],
			'anchor.y':  [{f:0,v:1}]
		}
	}
}

G.AnimationElement.prototype.changeAnimationData = function(animationName){

	if (!this.data[animationName]){
		animationName = Object.keys(this.data)[0];
	}

	this.eventTL = this.data[animationName].eventTL;
	this.frameTL = this.data[animationName].frameTL;
	this.propTLS = this.data[animationName].propTLS;
	this.propKeys = Object.keys(this.propTLS);
	this.currentAnimationData = this.data[animationName];
	this.currentAnimationName = animationName;
	this.updateAnimation(0);
	

};

G.AnimationElement.prototype.playAnimation = function(animationName){

	this.changeAnimationData(animationName);
	this.playing = true;

};

G.AnimationElement.prototype.getLastKeyFrame = function(tl,frameNr){

	var len = tl.length;
	for (var i = 0; i < len; i++){
		if (tl[i].f == frameNr || i == len-1) return tl[i];
		if (tl[i].f < frameNr && frameNr < tl[i+1].f){
			return tl[i];
		}
	};

};

G.AnimationElement.prototype.getNextKeyFrame = function(tl,frameNr){

	var len = tl.length;
	for (var i = 0; i < len; i++){
		if (tl[i].f > tl || i == len-1){
			return tl[i];
		}
	};

};

G.AnimationElement.prototype.getKeyFrameAt = function(tl,frameNr){

	if (!this.currentAnimationName) return null;

	for (var i = 0; i < tl.length; i++){
		var keyFrame = tl[i];
		if (keyFrame.f === frameNr) return keyFrame;
	}

	return null;
}

G.AnimationElement.prototype.isAnyKeyFrameAt = function(frameNr){

	if (!this.currentAnimationName) return false;

	if (this.getKeyFrameAt(this.eventTL,frameNr)) return true;
	if (this.getKeyFrameAt(this.frameTL,frameNr)) return true;

	for (var i = 0; i < this.propKeys.length; i++){
		var key = this.propKeys[i];
		if (this.getKeyFrameAt(this.propTLS[key],frameNr)) {
			return true;
		}
	}

	return false;

};

G.AnimationElement.prototype.getFrameValue = function(tl,frameNr){

	var lastKey = this.getLastKeyFrame(tl,frameNr);
	var nextKey = this.getNextKeyFrame(tl,frameNr);

	if (!lastKey.e){
		return lastKey.v;
	}else{
		var animLength = nextKey.f - lastKey.f;
		var valDiff = nextKey.v-lastKey.v;
		var easingVal = Phaser.Easing[lastKey.e[0]][lastKey.e[1]]((frameNr-lastKey.f)/animLength);
		return lastKey.v + (valDiff*easingVal);
	}

};


G.AnimationElement.prototype.updateAnimation = function(frameNr){

	if (!this.currentAnimationName) return;

	this.frameCounter = frameNr;

	this.updateFromPropTLS(frameNr);

	var frame = this.getTextureFrameValue(this.frameTL,frameNr);
	if (this.SPR.key != frame && this.SPR.frameName != frame){
		G.changeTexture(this.SPR,frame);
	}


}

G.AnimationElement.prototype.updateFromPropTLS = function(frameNr){

	for (var i = 0; i < this.propKeys.length; i++){
		var key = this.propKeys[i];
		this.setProp(key,this.getFrameValue(this.propTLS[key],frameNr));
	}

};

// lets make it a bit faster
G.AnimationElement.prototype.setProp = function(key,value){

	if (key == 'scale.x') this.SPR.scale.x = value;
	else if (key == 'scale.y') this.SPR.scale.y = value;
	else if (key == 'anchor.x') this.SPR.anchor.x = value;
	else if (key == 'anchor.y') this.SPR.anchor.y = value;
	else this.SPR[key] = value;

};


G.AnimationElement.prototype.getTextureFrameValue = function(tl,frameNr){

	var lastKey = this.getLastKeyFrame(tl,frameNr);

	var frameSkip = lastKey.frameSkip || 1;

	var frameDiff = frameNr-lastKey.f;

	frameDiff = Math.floor(frameDiff/frameSkip);

	if (!lastKey.animation){
		return lastKey.v;
	}else{

		var len = lastKey.v.length;

		if (lastKey.loop){
			
			if (!lastKey.refraction && !lastKey.reverse){
				return lastKey.v[frameDiff % len];
			}
			/*else if (!lastKey.refraction && lastKey.reverse){
				var fmod = frameNr % (len*2);
				return fmod < len ? lastKey.v[fmod] : (len-1)-(fmod-len);
			}*/
			else if (lastKey.refraction && !lastKey.reverse){
				return lastKey.v[Math.min(len-1,(frameDiff % (len+lastKey.refraction)))];
			}/*else if (lastKey.refraction && lastKey.reverse){

			}*/

		}else{
			return lastKey.v[Math.min(len-1,frameDiff)];			
		}
	}

}
G.GroupColliderLineLine = function(group1,group2,callback,context) {

	G.Image.call(this,0,0,null);

	this.group1 = group1;
	this.group2 = group2;
	this.callback = callback;
	this.context = context || null;

	this.collPoint = new Phaser.Point(0,0);

};

G.GroupColliderLineLine.prototype = Object.create(G.Image.prototype);

G.GroupColliderLineLine.prototype.update = function() {

	var len1 = this.group1.length;
	var len2 = this.group2.length;

	for (var i = 0; i < len1; i++) {
		var e1 = this.group1.children[i];
		for (var j = 0; j < len2; j++) {
			var e2 = this.group2.children[j];
			if (e1 === e2) continue;

			if (e1.collLine.intersects(e2.collLine, true, this.collPoint)) {
				this.callback.call(this.context,e1,e2,this.collPoint,this.group1,this.group2);
			} 

		}
	}

};


G.GroupColliderLineCircle = function(group1,group2,callback,context) {

	G.Image.call(this,0,0,null);

	this.group1 = group1;
	this.group2 = group2;
	this.callback = callback;
	this.context = context || null;

	this.collPoint = new Phaser.Point(0,0);

};

G.GroupColliderLineCircle.prototype = Object.create(G.Image.prototype);

G.GroupColliderLineCircle.prototype.update = function() {

	var len1 = this.group1.length;
	var len2 = this.group2.length;

	for (var i = this.group1.length; i--;) {
		var e1 = this.group1.children[i];
		for (var j = this.group2.length; j--;) {
			var e2 = this.group2.children[j];
			if (e1 === e2) continue;

			if (G.lineCircleColl(e1.collLine,e2.collCircle,this.collPoint)){
				this.callback.call(this.context,e1,e2,this.collPoint,this.group1,this.group2);
			} 

		}
	}

};
//OVERWRITES


//set alive to false
Phaser.Group.prototype.destroy = function (destroyChildren, soft) {

    if (this.game === null || this.ignoreDestroy) { return; }

    if (destroyChildren === undefined) { destroyChildren = true; }
    if (soft === undefined) { soft = false; }

    this.onDestroy.dispatch(this, destroyChildren, soft);

    this.removeAll(destroyChildren);

    this.cursor = null;
    this.filters = null;
    this.alive = false;
    this.pendingDestroy = false;

    if (!soft)
    {
        if (this.parent)
        {
            this.parent.removeChild(this);
        }

        this.game = null;
        this.exists = false;
    }

};


Phaser.exportChildren = function(obj){

    var result = [];

    for (var i = 0; i < obj.children.length; i++){
        var child = obj.children[i];
        if (child.exportToString){
            result.push(child.exportToString())
        }
    }

    return result;

};


Phaser.Group.prototype.exportToString = function(){

    var exportObj = {
        type: 'GROUP',
        x: this.x,
        y: this.y,
        scale: [this.scale.x,this.scale.y],
        angle: this.angle,
        children: Phaser.exportChildren(this)
    }

    return exportObj

};

Phaser.Image.prototype.exportToString = function(){

    exportObj = {
        type: 'IMG',
        x: this.x,
        y: this.y,
        frame: this.frameName,
        anchor: [this.anchor.x,this.anchor.y],
        scale: [this.scale.x,this.scale.y],
        angle: this.angle,
        children: Phaser.exportChildren(this)
    }

    return exportObj

};
if (typeof G == 'undefined') G = {};

G.Hex = function(grid) {
	if (grid) {
		this.grid = grid;
		this.type = this.setGridType(grid.type);
	}

};

G.Hex.constructor = G.Hex;

G.Hex.prototype.setGridType = function(type) {

	if (typeof type === 'undefined') return;

	if (type === G.HexGrid.ODD_R) {
		this.offsetToCube = this.oddRToCube;
		this.cubeToOffset = this.cubeToOddR;
	} else if (type === G.HexGrid.EVEN_R) {
		this.offsetToCube = this.evenRToCube;
		this.cubeToOffset = this.cubeToEvenR;
	} else if (type ===  G.HexGrid.ODD_Q) {
		this.offsetToCube = this.oddQToCube;
		this.cubeToOffset = this.cubeToOddQ;
	}else if (type ===  G.HexGrid.EVEN_Q) {
		this.offsetToCube = this.evenQToCube;
		this.cubeToOffset = this.cubeToEvenQ;
	}

	//in case grid type was added after setting coords
	if (typeof this.q !== 'undefined') {
		this.setAxial(this.q,this.r);
	}else if (typeof this.z !== 'undefined') {
		this.setCube(this.x,this.y,this.z);
	}

	//this.updatePixelPosition();

	return type;

};

G.Hex.prototype.updatePixelPosition = function() {

	if (this.grid && (typeof this.r !== 'undefined')) {

		this.px = -this.grid.pointerOffsetX;
		this.py = -this.grid.pointerOffsetY;

		if (this.grid.pointyTop) {
			this.px += this.grid.hexSize * Math.sqrt(3) * (this.q+this.r/2);
			this.py += this.grid.hexSize * (3/2)*this.r;
		}else {
			this.px += this.grid.hexSize * (3/2) * this.q;
			this.py += this.grid.hexSize * Math.sqrt(3) * (this.r+this.q/2);
		}	


		/*if (!this.corners) {
			this.corners = [];
			for (var i = 0; i < 6; i++) {
				this.corners.push(new Phaser.Point(0,0));
			}
		}

		this.updateCorners();*/
	}

};

G.Hex.prototype.countCorners = function() {

	for (var i = 0; i < 6; i++) {
		result.push(this.countCorner(i));
	}
	return result;

};

G.Hex.prototype.updateCorners = function(i) {

	for (var i = 0; i < 6; i++) {

		var angleDeg = 60 * i + (this.grid.pointyTop ? 30 : 0);
		var angleRad = Math.PI/180*angleDeg;
		this.corners[i].x = this.px + this.grid.hexSize * Math.cos(angleRad);
		this.corners[i].y = this.py + this.grid.hexSize * Math.sin(angleRad);

	}

};

G.Hex.prototype.setAxial = function(q,r) {
	this.q = q;
	this.r = r;
	this.axialToCube();
	if (this.grid) {
		this.cubeToOffset();
		//this.updatePixelPosition();
	}

	return this;
};

G.Hex.prototype.setCube = function(x,y,z) {
	this.x = x;
	this.y = y;
	this.z = z;
	this.cubeToAxial();
	if (this.grid) {
		this.cubeToOffset();
		//this.updatePixelPosition();
	}

	return this;
};

G.Hex.prototype.setOffset = function(col,row) {
	this.col = col;
	this.row = row;
	if (this.grid) {
		this.offsetToCube();
		this.cubeToAxial();
		//this.updatePixelPosition();
	}

	return this;
};

G.Hex.prototype.cubeToAxial = function() {
	this.q = this.x;
	this.r = this.z;
};

//static
G.Hex.add = function(hex1,hex2,out) {

	if (!out) {
		out = new G.Hex(hex1.type);
	}

	return out.copyFrom(hex1).add(hex2);

};

G.Hex.prototype.add = function(hex) {
	this.setCube(this.x+hex.x,this.y+hex.y,this.z+hex.z);
	return this;
};

//static
G.Hex.subtract = function(hex1,hex2,out) {

	if (!out) {
		out = new G.Hex(hex1.type);
	}

	return out.copyFrom(hex1).subtract(hex2);

};

G.Hex.prototype.subtract = function(hex) {
	this.setCube(this.x-hex.x,this.y-hex.y,this.z-hex.z);
	return this;
};


//static
G.Hex.equal = function(hex1,hex2) {

	return (hex1.x-hex2.x == 0
			&& hex1.y-hex2.y == 0
			&& hex1.z-hex2.z == 0)

};

G.Hex.prototype.equalTo = function(hex2) {

	return (this.x-hex2.x == 0
			&& this.y-hex2.y == 0
			&& this.z-hex2.z == 0)

};


//static
G.Hex.scale = function(hex,scale,out) {
	if (!out) {
		out = new G.Hex(hex.type);
	}

	return out.copyFrom(hex).scale(scale);

};

G.Hex.prototype.scale = function(scale) {
	if (scale > 0) {
		this.setCube(this.x*scale,this.y*scale,this.z*scale);
	}
	return this;
};

//static
G.Hex.areNeighbours = function(a,b) {

	return G.Hex.distance(a,b) == 1;

};

G.Hex.isNeighbourOf = function(hex) {

	return G.Hex.distance(this,hex) == 1;

};

//static
G.Hex.distance = function(a,b) {

	return Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y),Math.abs(a.z-b.z));

};

G.Hex.prototype.distanceTo = function(hex) {

	return G.Hex.distance(this,hex);

};

G.Hex.prototype.copyFrom = function(hex) {
	if (hex.type && hex.type !== this.type) this.setGridType(hex.type);
	this.setCube(hex.x,hex.y,hex.y);
	return this;
};

G.Hex.prototype.copyTo = function(hex) {
	if (this.type && this.type !== hex.type) hex.setGridType(hex.type);
	hex.setCube(this.x,this.y,this.z);
	return this;
};

G.Hex.prototype.round = function() {

	var rx = Math.round(this.x);
	var ry = Math.round(this.y);
	var rz = Math.round(this.z);

	var x_diff = Math.abs(rx-this.x);
	var y_diff = Math.abs(ry-this.y);
	var z_diff = Math.abs(rz - this.z);

	if (x_diff > y_diff && x_diff > z_diff) {
		rx = -ry-rz;
	}else if (y_diff > z_diff) {
		ry = -rx-rz;
	}	else {
		rz = -rx-ry;
	}

	this.setCube(rx,ry,rz);

	return this;

};


G.Hex.prototype.axialToCube = function() {
	this.x = this.q;
	this.z = this.r;
	this.y = -this.x-this.z;
};

G.Hex.prototype.cubeToEvenQ = function() {
	this.col = this.x;
	this.row = this.z+(this.x + (this.x%2))/2;
};

G.Hex.prototype.evenQToCube = function() {
	this.x = this.col;
	this.z = this.row-(this.col+(this.col%2))/2;
	this.y = -this.x-this.z;
};

G.Hex.prototype.cubeToOddQ = function() {
	this.col = this.x;
	this.row = this.z + (this.x-(this.x%2))/2;
};

G.Hex.prototype.oddQToCube = function() {
	this.x = this.col;
	this.z = this.row-(this.col-(this.col%2))/2;
	this.y = -this.x-this.z;
};

G.Hex.prototype.cubeToEvenR = function() {
	this.col = this.x+(this.z+(this.z%2))/2;
	this.row = this.z;
};

G.Hex.prototype.evenRToCube = function() {
	this.x = this.col-(this.row+(this.row%2))/2;
	this.z = this.row;
	this.y = -this.x-this.z;
};

G.Hex.prototype.cubeToOddR = function() {
	this.col = this.x+(this.z-(this.z%2))/2;
	this.row = this.z;
};

G.Hex.prototype.oddRToCube = function() {
	this.x = this.col-(this.row-(this.row%2))/2;
	this.z = this.row;
	this.y = -this.x-this.z;
};

G.Hex.prototype.toStringCube = function() {
	return this.x+'x'+this.y+'x'+this.z;
};

G.Hex.prototype.toStringOffset = function() {
	return this.col+'x'+this.row;
};

G.Hex.prototype.toStringAxial = function() {
	return this.q+'x'+this.r;
};
if (typeof G == 'undefined') G = {};

G.HexGrid = function(width,height,config) {

	this.config = config;

	//in case type was name, not number
	var type = config.hexType || 3;
	if (typeof type === 'string') {
		this.type = G.HexGrid.types.indexOf(type);
	}else {
		this.type = type;
	}

	this.pointyTop = type < 2;

	this.hexSize = config.tileSize ? G.l(config.tileSize) : G.l(40);
	this.hexWidth = this.getHexWidth();
	this.hexHeight = this.getHexHeight();

	//for board RT
	this.tileWidth = this.hexWidth;
	this.tileHeight = this.hexHeight;

	this.pointerOffsetX = this.getPointerOffsetX();
	this.pointerOffsetY = this.getPointerOffsetY();
	
	this.grid = new G.GridArray(width,height);
	this.grid.loop(function(v,col,row,data) {
		data[col][row] = new G.Hex(this).setOffset(col,row);
	},this);

	this.width = this.grid.width;
	this.height = this.grid.height;

	this._tmpHex = new G.Hex(this);
	this._tmpHex2 = new G.Hex(this);

	this.directions = [
		new G.Hex().setCube(+1,-1,0),
		new G.Hex().setCube(+1,0,-1),
		new G.Hex().setCube(0,+1,-1),
		new G.Hex().setCube(-1,+1,0),
		new G.Hex().setCube(-1,0,+1),
		new G.Hex().setCube(0,-1,+1)
	];

	this.directionsLabels = {
		"RD": this.directions[0],
		"RU": this.directions[1],
		"U" : this.directions[2],
		"LU" : this.directions[3],
		"LD" : this.directions[4],
		"D" : this.directions[5]
	};

};

G.HexGrid.types = ['oddR','evenR','oddQ','evenQ'];
G.HexGrid.ODD_R = 0;
G.HexGrid.EVEN_R = 1;
G.HexGrid.ODD_Q = 2;
G.HexGrid.EVEN_Q = 3;

G.HexGrid.prototype.getPointerOffsetX = function() {
		//change pixel coord depend on type

	return this.type == G.HexGrid.EVEN_R ? -this.hexWidth : -this.hexWidth*0.5;

	if (this.type == G.HexGrid.ODD_R) {
		x -= this.hexWidth*0.5;
	}else if (this.type == G.HexGrid.EVEN_R) {
		x -= this.hexWidth;
	}else if (this.type == G.HexGrid.ODD_Q) {
		x -= this.hexWidth*0.5;
	}else if (this.type == G.HexGrid.EVEN_Q) {
		x -= this.hexWidth*0.5;
	}

};

G.HexGrid.prototype.getPointerOffsetY = function() {
		//change pixel coord depend on type
	return this.type == G.HexGrid.EVEN_Q ? -this.hexHeight : -this.hexHeight*0.5;

}

G.HexGrid.prototype.getHexWidth = function() {
	if (this.pointyTop) {
		return Math.sqrt(3)/2 * (this.hexSize*2);
	}else {
		return this.hexSize*2;
	}	
};

G.HexGrid.prototype.getHexHeight = function() {
	if (this.pointyTop) {
		return this.hexSize*2;
	}else {
		return Math.sqrt(3)/2*(this.hexSize*2);
	}
};

G.HexGrid.prototype.getPxPosition = function(x,y,out) {

	if (typeof out === 'undefined') {
		out = new Phaser.Point(0,0);
	}

	this._tmpHex.setOffset(x,y);

	out.x = -this.pointerOffsetX;
	out.y = -this.pointerOffsetY;

	if (this.pointyTop) {
		out.x += this.hexSize * Math.sqrt(3) * (this._tmpHex.q+this._tmpHex.r/2);
		out.y += this.hexSize * (3/2)*this._tmpHex.r;
	}else {
		out.x += this.hexSize * (3/2) * this._tmpHex.q;
		out.y += this.hexSize * Math.sqrt(3) * (this._tmpHex.r+this._tmpHex.q/2);
	}	

	out.x = Math.floor(out.x);
	out.y = Math.floor(out.y);

	return out;

};

G.HexGrid.prototype.pixelToCoord = function(x,y,startPoint,scalePoint,out) {

	var q, r;
	
	x = ((x-startPoint.x)*(1/scalePoint.x))+this.pointerOffsetX;
	y = ((y-startPoint.y)*(1/scalePoint.y))+this.pointerOffsetY;

	
	//axial coordinates
	if (this.pointyTop) {
		q = (x * Math.sqrt(3)/3 - y / 3) / this.hexSize;
    	r = y * 2/3 / this.hexSize;
	}else {
		q = x * 2/3 / this.hexSize;
    	r = (-x / 3 + Math.sqrt(3)/3 * y) / this.hexSize;
	}


	this.hlHex = new G.Hex(this).setAxial(q,r).round();
	if (out) {
		out.x = this.hlHex.col;
		out.y = this.hlHex.row;
		return out;
	}else {

		return new Phaser.Point(this.hlHex.col,this.hlHex.row);
			
	}

};

G.HexGrid.prototype.dbgDrawGrid = function(gfx) {

	gfx.clear();

	gfx.beginFill(0x333333,1);
	gfx.lineStyle(2,0x000000,1);

	this.grid.loop(function(hex,x,y) {

		if (this.hlHex && this.hlHex.col == x && this.hlHex.row == y) {
			gfx.beginFill(0x333333,1);
		}else {
			gfx.beginFill(0x333333,0.5);
		}

		if (hex.hl) {
			gfx.beginFill(0xff0000,0.5);
		}

		gfx.drawPolygon(hex.corners);

	},this);

};

G.HexGrid.prototype.getNeighbourCoords = function(x,y,direction,out) {

	var dir;

	if (typeof out === 'undefined') {
		out = {}
	}

	if (typeof direction === 'string') {
		dir = this.directionsLabels[direction];
	}else {

		direction = direction%this.directions.length;
		if (direction < 0) direction = this.directions.length+direction;
 
		dir = this.directions[direction];
	}
	
	this._tmpHex.setOffset(x,y).add(dir);

	out.x = this._tmpHex.col;
	out.y = this._tmpHex.row;
	return out;
	
};



G.HexGrid.prototype.areNeighbours = function(x,y,x2,y2) {

	this._tmpHex.setOffset(x,y);
	this._tmpHex2.setOffset(x2,y2);
	return this._tmpHex.isNeighbourOf(this._tmpHex2);

};

G.HexGrid.prototype.getRing = function(x,y,radius) {

	var result = [];
	if (radius < 0) return result;
	var scaledDirection = new G.Hex(this).copyFrom(this.directions[3]).scale(radius);
	var cube = new G.Hex(this).setOffset(x,y).add(scaledDirection);
	
	for (var i = 0; i < 6; i++) {
		for (var j = 0; j < radius; j++) {

			var val = this.getGridValOffset(cube.col,cube.row);
			if (val) result.push(val);
			cube.add(this.directions[i]);
		}
	}

	result.forEach(function(h){h.hl=true;});

	return result;

};


//for possible movement direction check
G.HexGrid.prototype.getDirection = function(x,y,x2,y2) {

	this._tmpHex.setOffset(x2,y2).subtract(this._tmpHex2.setOffset(x,y));

	for (dir in this.directionsLabels) {
		if (G.Hex.equal(this.directionsLabels[dir],this._tmpHex)) {
			return dir;
		}
	}	

	return false;

};

G.HexGrid.prototype.isMoveValid = function(x,y,x2,y2){

	return this.getDirection(x,y,x2,y2);

};

G.HexGrid.prototype.getGridValAxial = function(q,r) {
	this._tmpHex.setAxial(q,r);
	return this.grid.get(this._tmpHex.col,this._tmpHex.row);
};

G.HexGrid.prototype.getGridValOffset = function(col,row) {
	return this.grid.get(col,row);
};

G.HexGrid.prototype.getGridVal = G.HexGrid.prototype.getGridValOffset;

G.HexGrid.prototype.getGridValCube = function(x,y,z) {
	this._tmpHex.setCube(x,y,z);
	return this.grid.get(this._tmpHex.col,this._tmpHex.row);
};
if (typeof G == 'undefined') G = {};

G.Square = function(grid,x,y) {
	this.grid = grid;
	this.x = x;
	this.y = y;
	this.updatePixelPosition();
};

G.Square.constructor = G.Triangle;

G.Square.prototype.updatePixelPosition = function() {

		this.px = this.x*this.grid.squareWidth+(this.grid.squareWidth*0.5);
		this.py = this.y*this.grid.squareWidth+(this.grid.squareWidth*0.5);

};

G.Square.prototype.setTo = function(x,y) {

	this.x = x;
	this.y = y;
	this.getDirection();
	this.updatePixelPosition();

};

//static
G.Square.add = function(a,b,out) {

	if (!out) {
		out = new G.Triangle(a.grid,a.x,a.y);
	}

	return out.add(b);

};

G.Square.prototype.add = function(b) {
	this.setTo(this.x+b.x,this.y+b.y);
	return this;
};

//static
G.Square.areNeighbours = function(a,b) {
	return a.isNeighbourOf(b);
};

G.Square.isNeighbourOf = function(b) {

	var diff = Math.max(Math.abs(this.x-b.x),Math.abs(this.y-b.y));
	return diff == 1;

};

G.Square.prototype.copyFrom = function(b) {
	this.setTo(b.x,b.y);
	return this;
};

G.Square.prototype.copyTo = function(b) {
	b.setTo(this.x,this.y);
	return this;
};


G.Square.prototype.toString = function() {
	return this.x+'x'+this.y+' dir: '+this.dir;
};
if (typeof G == 'undefined') G = {};

G.SquareGrid = function(width,height,config) {

	this.config = config;

	this.squareWidth = config.tileSize ? G.l(config.tileSize) : G.l(76);
	this.squareHeight = config.tileSize ? G.l(config.tileSize) : G.l(76); 
	this.pointerOffsetX = 0;
	this.pointerOffsetY = 0;

	this.tilePadding = config.tilePadding || 0;
	//for boardRT
	this.tileWidth = config.tileSize;
	this.tileHeight = config.tileSize;

	this.grid = new G.GridArray(width,height);
	this.grid.loop(function(v,col,row,data) {
		data[col][row] = new G.Square(this,col,row);
	},this);

	this.width = this.grid.width;
	this.height = this.grid.height;

	this.directions = [
		[1,0],
		[1,-1],
		[0,-1],
		[-1,-1],
		[-1,0],
		[-1,1],
		[0,1],
		[1,1]
	];

	this.directionsLabels = {
		"R": this.directions[0],
		"RU": this.directions[1],
		"U" : this.directions[2],
		"LU" : this.directions[3],
		"L" : this.directions[4],
		"LD" : this.directions[5],
		"D" : this.directions[6],
		"RD" : this.directions[7]
	};

};

G.SquareGrid.prototype.pixelToCoord = function(x,y,startPoint,scalePoint,out) {
	
	x = (x+this.pointerOffsetX-startPoint.x)*(1/scalePoint.x);
	y = (y+this.pointerOffsetY-startPoint.y)*(1/scalePoint.y);

	var cellX;
	var cellY;

	if (this.tilePadding > 0) {

		var cellXNF = x/(this.squareWidth+this.tilePadding);
		var cellYNF = y/(this.squareHeight+this.tilePadding);

		//check if pointer is on square, not padding
		if (cellXNF <= Math.floor(cellXNF)+(this.squareWidth/(this.squareWidth+this.tilePadding))
			&& cellYNF <= Math.floor(cellYNF)+(this.squareHeight/(this.squareHeight+this.tilePadding))) {

			cellX = Math.floor(cellXNF);
			cellY = Math.floor(cellYNF);

			//it is on padding. return ridiculous values
		}else {	

			cellX = -999999;
			cellY = -999999;

		}

		
	}else {

		cellX = Math.floor(x/this.squareWidth);
		cellY = Math.floor(y/this.squareHeight);

	}

	if (out) {

		out.x = cellX;
		out.y = cellY;

	}else {

		return new Phaser.Point(cellX,cellY);

	}

};

G.SquareGrid.prototype.getPxPosition = function(x,y,out) {

	if (typeof out === 'undefined') {
		out = new Phaser.Point(0,0);
	}
	out.x = Math.floor(x*(this.squareWidth+this.tilePadding)+(this.squareWidth*0.5));
	out.y = Math.floor(y*(this.squareWidth+this.tilePadding)+(this.squareWidth*0.5));

	return out;

};


G.SquareGrid.prototype.dbgDrawGrid = function(gfx) {

	gfx.clear();

	gfx.beginFill(0x333333,1);
	gfx.lineStyle(2,0x000000,1);

	this.grid.loop(function(tr,x,y) {
		
		gfx.beginFill(0x333333,0.5);

		gfx.drawRect(x*(this.squareWidth+this.tilePadding),y*(this.squareHeight+this.tilePadding),this.squareWidth,this.squareHeight);

	},this);

};

G.SquareGrid.prototype.getNeighbourCoords = function(x,y,direction,out) {

	var dir;

	if (typeof out === 'undefined') {
		out = {}
	}

	if (typeof direction === 'string') {
		dir = this.directionsLabels[direction];
	}else {
		dir = this.directions[direction];
	}


	out.x = x+dir[0];
	out.y = y+dir[1];
	return out;
	

};

//for possible movement direction check
G.SquareGrid.prototype.getDirection = function(x,y,x2,y2) {

	for (dir in this.directionsLabels) {
		if (this.directionsLabels[dir][0] == x2-x
			&& this.directionsLabels[dir][1] == y2-y){
			return dir;
		}
	}

	return false;

};

G.SquareGrid.prototype.isMoveValid = function(x,y,x2,y2){

	var dir = this.getDirection(x,y,x2,y2);

	if (dir === 'U' || dir === 'D' || dir === 'L' || dir === 'R') {
		return true;
	}else {
		return false;
	}

};

G.SquareGrid.prototype.areNeighbours = function(x,y,x2,y2) {

	return Math.max(Math.abs(x-x2),Math.abs(y-y2)) == 1;

};

G.SquareGrid.prototype.getGridVal = function(col,row) {
	return this.grid.get(col,row);
};



G.SquareGrid.prototype.getRing = function(x,y,radius) {

	radius = radius || 1;

	var result = [];
	var point = {x:x,y:y}

	for (var radiusOffset = 0; radiusOffset<radius; radiusOffset++) {
		this.getNeighbourCoords(point.x,point.y,'LD',point);
	}

	var directions = ['R','U','L','D'];

	for (var dirIndex = 0; dirIndex < 4; dirIndex++) {
		var dir = directions[dirIndex];
		for (var i = 0; i < radius+1; i++) {
			this.getNeighbourCoords(point.x,point.y,dir,point);
			result.push({x:point.x,y:point.y});
		}
	}

	return result;

};
if (typeof G == 'undefined') G = {};

G.Triangle = function(grid,x,y) {
	this.grid = grid;
	this.x = x;
	this.y = y;
	this.updatePixelPosition();
};

G.Triangle.constructor = G.Triangle;

G.Triangle.prototype.updatePixelPosition = function() {

		this.px = this.x*this.grid.triangleWidth;
		this.py = this.y*(this.grid.triangleHeight*0.5);

		if (!this.corners) {
			this.corners = [];
			for (var i = 0; i < 3; i++) {
				this.corners.push(new Phaser.Point(0,0));
			}
		}

		this.dir = this.getDirection();
		this.updateCorners();

};

G.Triangle.prototype.setTo = function(x,y) {

	this.x = x;
	this.y = y;
	this.getDirection();
	this.updatePixelPosition();

};

G.Triangle.prototype.getDirection = function() {

	var result = 0;

	var colMod = this.x%2;
	var rowMod = this.y%2;

	var sumMod = (colMod+rowMod)%2;

	return (this.grid.firstDir+sumMod)%2;

};

G.Triangle.prototype.updateCorners = function(i) {

	if (this.dir == 1) {
		this.corners[0].x = this.px;
		this.corners[0].y = this.py;
		this.corners[1].x = this.px+this.grid.triangleWidth;
		this.corners[1].y = this.py+(this.grid.triangleHeight*0.5);
		this.corners[2].x = this.px;
		this.corners[2].y = this.py+this.grid.triangleHeight;
	}else {
		this.corners[0].x = this.px;
		this.corners[0].y = this.py+this.grid.triangleHeight*0.5;
		this.corners[1].x = this.px+this.grid.triangleWidth;
		this.corners[1].y = this.py;
		this.corners[2].x = this.px+this.grid.triangleWidth;
		this.corners[2].y = this.py+this.grid.triangleHeight;
	}

};


//static
G.Triangle.add = function(a,b,out) {

	if (!out) {
		out = new G.Triangle(a.grid,a.x,a.y);
	}

	return out.add(b);

};

G.Triangle.prototype.add = function(b) {
	this.setTo(this.x+b.x,this.y+b.y);
	return this;
};

//static
G.Triangle.areNeighbours = function(a,b) {
	return a.isNeighbourOf(b);
};

G.Triangle.isNeighbourOf = function(b) {

	var diff = Math.max(Math.abs(this.x-b.x),Math.abs(this.y-b.y));
	return diff == 1;

};

G.Triangle.prototype.copyFrom = function(b) {
	this.setTo(b.x,b.y);
	return this;
};

G.Triangle.prototype.copyTo = function(b) {
	b.setTo(this.x,this.y);
	return this;
};


G.Triangle.prototype.toString = function() {
	return this.x+'x'+this.y+' dir: '+this.dir;
};
if (typeof G == 'undefined') G = {};

G.TriangleGrid = function(width,height,config) {

	this.config = config;

	//triangleWidth,triangleHeight,firstDir,
	this.triangleWidth = config.triangleWidth || 106;
	this.triangleHeight = config.triangleHeight || 122;
	this.firstDir = config.firstDir || 0;
	this.pointerOffsetX = 0;
	this.pointerOffsetY = 0;
	//for boardRT
	this.tileWidth = this.triangleWidth;
	this.tileHeight = this.triangleHeight;

	this.gemSideOffset = config.gemSideOffset || 0.3;

	this.grid = new G.GridArray(width,height);
	this.grid.loop(function(v,col,row,data) {
		data[col][row] = new G.Triangle(this,col,row);
	},this);

	this.width = width;
	this.height = height;


	this.directions = [
		"RD",
		"RU",
		"U",
		"LU",
		"LD",
		"D"
	];

	this.directionsLabels = {
		"L": [-1,0],
		"R": [1,0],
		"U": [0,-1],
		"D": [0,1]
	};

};

G.TriangleGrid.prototype.getPxPosition = function(x,y,out) {

	if (typeof out === 'undefined') {
		out = new Phaser.Point(0,0);
	}

	var right = this.isPointingRight(x,y);

	var px = x*this.triangleWidth+(this.triangleWidth*(right?this.gemSideOffset:1-this.gemSideOffset));
	var py = y*this.triangleHeight*0.5+(this.triangleHeight*0.5);

	out.x = px;
	out.y = py;

	return out;

};

G.TriangleGrid.prototype.pixelToCoord = function(x,y,startPoint,scalePoint,out) {
	
	x = (x+this.pointerOffsetX-startPoint.x)*(1/scalePoint.x);
	y = (y+this.pointerOffsetY-startPoint.y)*(1/scalePoint.y);
	
	//cellX is certain from that point
	var col = Math.floor(x/this.triangleWidth);
	var row = Math.floor(y/(this.triangleHeight*0.5));

	this.__rawCol = col; 
	this.__rawRow = row;

	var xOffset = (x-(col*this.triangleWidth))/this.triangleWidth;
	var yOffset = (y-(row*this.triangleHeight*0.5))/(this.triangleHeight*0.5);

	if (this.__rawDir = this.isPointingRight(col,row) == 1) {
		if (xOffset > yOffset) {
			row--;
		}
	}else {
		if (xOffset < (1-yOffset)) {
			row--;
		}
	}

	if (out) {
		out.x = col;
		out.y = row;
	}else {
		return new Phaser.Point(col,row);
	}

};

G.TriangleGrid.prototype.isPointingRight = function(x,y) {

	var result = 0;

	var colMod = x%2;
	var rowMod = y%2;

	var sumMod = (colMod+rowMod)%2;

	return (this.firstDir+sumMod)%2;

};


G.TriangleGrid.prototype.dbgDrawGrid = function(gfx) {

	gfx.clear();

	gfx.beginFill(0x333333,1);
	gfx.lineStyle(2,0x000000,1);

	this.grid.loop(function(tr,x,y) {

		if (this.hlTriangle && this.hlTriangle.x == x && this.hlTriangle.y == y) {
			gfx.beginFill(0x333333,1);
		}else {
			gfx.beginFill(0x333333,0.5);
		}

		gfx.drawPolygon(tr.corners);

	},this);

};

G.TriangleGrid.prototype.getNeighbourCoords = function(x,y,dir,out) {

	if (typeof out == 'undefined') out = {};

	var right = this.isPointingRight(x,y);

	if (dir == 'U' || (right && dir == 'RU') || (!right && dir == 'LU')){
		out.x = x;
		out.y = y-1;
		return out;
	}

	if (dir == 'D' || (right & dir == 'RD') || (!right & dir == 'LD')){
		out.x = x;
		out.y = y+1;
		return out;
	}

	if (dir == 'L' || (right && (dir == 'LU' || dir == 'LD'))){
		out.x = x-1;
		out.y = y;
		return out;
	}

	if (dir == 'R' || (!right && (dir == 'RD' || dir == 'RU'))){
		out.x = x+1;
		out.y = y;
		return out;
	}

};

G.TriangleGrid.prototype.getDirection = function(x,y,x2,y2){

	for (dir in this.directionsLabels) {
		if (this.directionsLabels[dir][0] == x2-x
			&& this.directionsLabels[dir][1] == y2-y){
			return dir;
		}
	}

	return false;


};

G.TriangleGrid.prototype.getGridVal = function(col,row) {
	return this.grid.get(col,row);
};

G.TriangleGrid.prototype.getRing = function(x,y,radius){

	console.warn('getRing to be implemented');

};

G.TriangleGrid.prototype.isMoveValid = function(x,y,x2,y2){

	var right = this.isPointingRight(x,y);
	var dir = this.getDirection(x,y,x2,y2);

	if (!dir) return false;

	if ((right && dir == 'R') || (!right && dir == 'L')) {
		return false;
	}

	return dir;

};
G.Modify = function() {

	//in case that G.Modify was invoked without new
	if (this === G){
		return new G.Modify();
	}

	Phaser.Group.call(this,game);

	G.Modify.instance = this;

	this.onLevelObjChange = new Phaser.Signal();
	this.onCurrentObjChange = new Phaser.Signal();
	this.onObjDestroy = new Phaser.Signal();
	this.onCurrentObjPropModified = new Phaser.Signal();

	game.state.onStateChange.addOnce(this.turnOff,this);

	this.inputBlocker = new G.ModifyInputBlocked();
	this.add(this.inputBlocker);

	game.stage.disableVisibilityChange = true;
	game.paused = false;

	obj = game.state.getCurrentState();

	if (obj === game.state.getCurrentState()) {
		game.state.getCurrentState().children = game.world.children;
	}

	this.objectName = 'WORLD'; 

	this.currentLevel = game.world; 
	this.currentObject = null;


	this.gfx = game.add.graphics();
	this.gfx.fixedToCamera = true;
	this.add(this.gfx);
	this.obj = obj;

	//this.propGroup = this.add(new G.ModifyPropGroup(this));
	
	/*
	this.buttonGroup = new G.ModifyButtonGroup();
	this.add(this.buttonGroup);
	*/

	this.leftBar = document.createElement('div');
	this.leftBar.style.position = 'fixed';
	this.leftBar.style.top= '0';
	this.leftBar.style.left = '0';
	this.leftBar.style.pointerEvents = 'none';
	document.body.appendChild(this.leftBar);

	this.childList = new G.ModifyDOMChildList(this);
	this.leftBar.appendChild(this.childList.mainDiv);

	this.propList = new G.ModifyDOMPropList(this);
	this.leftBar.appendChild(this.propList.mainDiv);


	this.bottomBar = document.createElement('div');
	this.bottomBar.style.position = 'fixed';
	this.bottomBar.style.bottom = '0';
	this.bottomBar.style.left = '0';
	this.bottomBar.style.width = '100%';
	document.body.appendChild(this.bottomBar);

	this.objectFactory = new G.ModifyObjectFactory(this);
	this.objectFactory.onObjectAdded.add(function(obj){
		this.changeCurrentObject(obj);
		this.refreshLevel();
	},this);
	this.bottomBar.appendChild(this.objectFactory.mainDiv);


	this.buttonGroup = new G.ModifyDOMButtonGroup(this);


	//this.bottomBar = this.add(new G.ModifyBottomBar());

	this.frameSelector = new G.ModifyDOMFrameSelector();
	this.frameSelector.onFrameClicked.add(this.changeFrame,this);

	this.addKeyboardControlls();

	this.animationEditor = new G.ModifyAnimationEditor(this);
	this.add(this.animationEditor);

	this.removeCash = {};

	this.codeGenerator = new G.ModifyCodeGenerator(this);

	if (!game.state.states.MODIFYEMPTYSTATE){
		game.state.add('MODIFYEMPTYSTATE',{
			create: function(){
				new G.Modify();
			}
		});
	};

	this.domLayer = new G.ModifyDOMLayer(this);

	game.input.onDown.add(this.processClick,this);

	this.changeLevelObject(game.world);
	
};

G.Modify.prototype = Object.create(Phaser.Group.prototype);

G.Modify.prototype.removeCashObjToString = function(levelObjTxt) {

	if (!this.removeCash[levelObjTxt]) return '';
	
	var str = '\tREMOVED:'
	for (var i = 0; i < this.removeCash[levelObjTxt].length; i++) {
		str += '\t\t'+this.removeCash[levelObjTxt][i]+'\n'
	}
	return str;

};

G.Modify.prototype.removeObject = function() {

	console.log('removeObject');

	var obj = this.getCurrentObject();
	if (!obj) return;
	obj.destroy();
	this.currentObject = null;
	this.refreshLevel();

};

G.Modify.prototype.refreshLevel = function() {

	this.currentLevel = this.currentLevel;
	this.onLevelObjChange.dispatch(this.currentLevel);

};

G.Modify.prototype.update = function() {

	this.updateKeyboard();
	this.redrawGfx();

	for (var i = 0; i < this.children.length; i++){
		this.children[i].update();
	}

};

G.Modify.prototype.getChildrenData = function(obj){

	obj = obj || this.currentLevel;

	var childrenData = [];

	for (var i = 0; i < obj.children.length; i++){

		var found = false;
		var child = obj.children[i];

		// in case G.Modify
		if (child === this) {
			continue;
		}

		var hasChildren = (obj.children[i].children && obj.children[i].children.length > 0) || obj.children[i].constructor === Phaser.Group;
		var isTextObj = obj.children[i].constructor == G.OneLineText || obj.children[i].constructor == G.MultiLineText;

		var childData = {
			label: this.getChildLabel(child),
			openable: !isTextObj,
			hasChildren: hasChildren,
			obj: child,
			current: child == this.currentObject
		};

		childrenData.push(childData);

	}

	return childrenData;

};

G.Modify.prototype.getChildLabel = function(child){

	var parent = child.parent;

	if (parent == game.stage) child.___LABEL = 'WORLD';

	if (child.___LABEL)	{
		return child.___LABEL
	}else{

		//in case of lvlobj being world change to state (as it is more probable to have world children as prop)
		var propObj = parent == game.world ? game.state.getCurrentState() : parent;

		//child doesnt have a label, so lets try to find prop that hold it
		for (var prop in propObj) {
			
			//wtf why cursor?
			if (prop == 'children' || prop == 'cursor') {
				continue;
			}
			
			if (child === propObj[prop]) {
				//found good name so lets make label out of it
				child.___LABEL = prop;
				return child.___LABEL;
			}

			if (Array.isArray(propObj[prop]) && prop !== 'children') {
				var index = propObj[prop].indexOf(child);
				if (index > 0){
					return 'prop['+index+']';
				};
			}

		}

	}

	//if everything fails just get children[i]
	return 'children['+parent.children.indexOf(child)+']';

};

G.Modify.prototype.getCurrentObject = function() {
	return this.currentObject;
};

G.Modify.prototype.changeFrame = function(newFrame) {

	console.log(newFrame);

	var obj = this.getCurrentObject();

	this.saveInitPropValue('frameName',newFrame);

	if (obj.loadTexture) {
		G.changeTexture(obj,newFrame);
	}

	this.onCurrentObjPropModified.dispatch();

};

G.Modify.prototype.getCurrentLevelObject = function() {

	return this.currentLevel;


};

G.Modify.prototype.redrawGfx = function() {

	return; 

	this.gfx.clear();


	//whole group

	var obj = this.getCurrentLevelObject();

	if (obj !== game.state.getCurrentState()) {

		var bounds = obj.getLocalBounds();
		this.gfx.lineStyle(3, 0xff0000, 0.2);
		this.gfx.drawRect(
			obj.worldPosition.x+bounds.x,
			obj.worldPosition.y+bounds.y,
			bounds.width,
			bounds.height);

		this.gfx.beginFill(0x000000,0.5);
		this.gfx.drawRect(obj.worldPosition.x-10,obj.worldPosition.y-10,20,20);
		
	}

	
	this.gfx.beginFill(0x000000,0);


	//childrens

	this.childrenPropNames.forEach(function(key,index) {

		var activeObj = index == this.currentChildIndex;
		this.gfx.lineStyle(activeObj ? 3 : 1, 0x0000ff, activeObj ? 1 : 0.2);
		var obj = this.getCurrentLevelObject().children[index];
		if (!obj) return;
		var bounds = obj.getBounds();
		var localBounds = obj.getLocalBounds();
		this.gfx.drawRect(
			obj.worldPosition.x+localBounds.x*obj.scale.x,
			obj.worldPosition.y+localBounds.y*obj.scale.y,
			bounds.width*obj.scale.x,
			bounds.height*obj.scale.y
		);

		if (activeObj && obj.maxUserWidth && !obj.maxUserHeight) {

			this.gfx.lineStyle(2,0x00ff00,0.5);
			this.gfx.drawRect(
				obj.worldPosition.x - (obj.anchor.x*obj.maxUserWidth),
				obj.worldPosition.y - (obj.anchor.y*obj.height),
				obj.maxUserWidth,
				obj.height
			);
		}else if (activeObj && obj.maxUserWidth && obj.maxUserHeight) {

			this.gfx.lineStyle(2,0x00ff00,0.5);
			this.gfx.drawRect(
				obj.worldPosition.x - (obj.anchor.x*obj.maxUserWidth),
				obj.worldPosition.y - (obj.anchor.y*obj.maxUserHeight),
				obj.maxUserWidth,
				obj.maxUserHeight
			);
		}

	},this);

};


G.Modify.prototype.addKeyboardControlls = function() {

	this.keys = game.input.keyboard.addKeys({
		'Q':Phaser.Keyboard.Q,
		'W':Phaser.Keyboard.W,
		'E':Phaser.Keyboard.E,
		'UP':Phaser.Keyboard.UP,
		'ONE':Phaser.Keyboard.ONE,
		'TWO':Phaser.Keyboard.TWO,
		'DOWN':Phaser.Keyboard.DOWN,
		'RIGHT':Phaser.Keyboard.RIGHT,
		'LEFT':Phaser.Keyboard.LEFT,
		'ALT':Phaser.Keyboard.ALT,
		'Z':Phaser.Keyboard.Z,
		'X':Phaser.Keyboard.X,
		'C':Phaser.Keyboard.C,
		'U':Phaser.Keyboard.U,
		'PLUS': 107,
		'MINUS': 109,
		'ESC': Phaser.Keyboard.ESC,
		'NUM8': 104,
		'NUM5': 101,
		'NUM4': 100,
		'NUM6': 102,
		'NUM2': 98,
		'NUM7': 103,
		'NUM9': 105,
		'NUMSTAR': 106,
		'SPACE' : Phaser.Keyboard.SPACEBAR,
		'V': Phaser.Keyboard.V,
		'L': Phaser.Keyboard.L,
		'I': Phaser.Keyboard.I,
		'P': Phaser.Keyboard.P,
		'O': Phaser.Keyboard.O,
		'M': Phaser.Keyboard.M,
		'DEL': Phaser.Keyboard.DELETE,
		'sqBracketOpen': 219,
		'sqBracketClose': 221,
		'SHIFT': Phaser.Keyboard.SHIFT

	});


	this.keys.sqBracketOpen.onDown.add(function(){
		if (this.keys.SHIFT.isDown) {
			this.objToBottom();
		}else {
			this.objMoveDown();
		}
	},this);

	this.keys.sqBracketClose.onDown.add(function(){
		if (this.keys.SHIFT.isDown) {
			this.objToTop();
		}else {
			this.objMoveUp();
		}
	},this);



	this.keys.frameCounter = 0; 

	this.keys.L.onDown.add(function(){
		var lvlObj = this.getCurrentLevelObject();
		var obj = this.getCurrentObject();

		if (!obj) return;

		this.domLayer.openInputDiv(
		(obj.___LABEL || 'obj')+' | label',
		obj.___LABEL || '',
		function(value){
			if (lvlObj[value] === undefined) {

				if (obj.___LABEL){
					delete lvlObj[obj.___LABEL];
				}

				lvlObj[value] = obj;
				obj.___LABEL = value;
				this.refreshLevel();
			}
		},
		this,'string');

	},this);


	//change children +1
	this.keys.Q.onDown.add(function() {
		this.changeCurrentChildrenIndex(-1);
	},this);

	//change children -1
	this.keys.W.onDown.add(function() {
		this.changeCurrentChildrenIndex(1);
	},this);

	//enter child
	this.keys.TWO.onDown.add(function() {
		if (!this.currentObject) return;
		this.changeLevelObject(this.currentObject);
	},this);

	//exit child
	this.keys.ONE.onDown.add(this.currentLevelGoUp,this);

	//kill modify
	this.keys.ESC.onDown.add(function(){
		if (this.escPressed === undefined){
			this.escPressed = 0;
		}

		this.escPressed++;
		game.time.events.add(2000,function(){
			this.escPressed = 0;
		},this)

		if (this.escPressed < 5) return;

		this.turnOff();

	},this);




	this.keys.E.onDown.add(function() {
		this.exportChanges();
	},this);

	//restar to initial position
	this.keys.NUM5.onDown.add(function() {

		var obj = this.getCurrentObject();

		if (!obj) return;

		obj.scale.setTo(1);
		obj.angle = 0;
		obj.alpha = 1;
		obj.visible = true;
		obj.anchor.setTo(0.5);

	},this);

	

	

	//change alpha settings
	this.keys.V.onDown.add(function(){
		this.alpha = this.alpha == 1 ? 0.1 : 1;
	},this);

	//mark obj as constructor
	this.keys.O.onDown.add(function(){
		var obj = this.getCurrentObject();
		if (obj instanceof Phaser.Group) {
			obj.___CONSTRUCTOR = true;
		}
	},this);

	//generate code
	this.keys.P.onDown.add(function(){
		var obj = this.getCurrentObject();
		var str = this.codeGenerator.start(obj);
	},this);


	this.keys.C.onDown.add(function(){
		var pointer = game.input.activePointer;
		var newObj = this.addImage();
		this.setNewCurrentChildren(newObj);
		this.moveCurrentObjectToWorldPos(pointer.x,pointer.y);

	},this);

	//go to modify empty state
	this.keys.I.onDown.add(function(){
		if (this.pressCounterI === undefined) {
			this.pressCounterI = 0;
		}

		this.pressCounterI++;

		if (this.pressCounterI == 3){
			game.state.start('MODIFYEMPTYSTATE');
		}

		game.time.events.add(1000,function(){
			this.pressCounterI = 0;
		},this);
	},this);

	this.keys.DEL.onDown.add(this.removeObject,this);

	this.keys.NUMSTAR.onDown.add(this.frameSelector.toggle,this.frameSelector);

	//hide child list
	this.keys.U.onDown.add(function(){
		this.childList.toggleList();
	},this);

};

G.Modify.prototype.turnOff = function(force) {

	for (key in this.keys) {
		if (this.keys[key].onDown) {
			this.keys[key].onDown.removeAll();
		}
	}	


	this.gfx.destroy();
	this.buttonGroup.destroy();
	this.frameSelector.destroy();

	//this.levelTxt.destroy();
	//this.propGroup.destroy();
	//this.groupTxt.destroy();

	this.leftBar.remove();
	this.destroy();

};


G.Modify.prototype.modifyCurrentObjProp = function(prop,value){

	var obj = this.getCurrentObject();
	this.saveInitPropValue(prop,value);
	G.Utils.setObjProp(obj,prop,value);
	this.onCurrentObjPropModified.dispatch();

};

G.Modify.prototype.saveInitPropValue = function(prop,newVal){

	var obj = this.getCurrentObject();

	if (Array.isArray(prop)) prop = prop.join('.');

	var val = G.Utils.getObjProp(obj,prop);

	//exit if nothing changes
	if (val === newVal) return;

	if (!obj.___initState) obj.___initState = {};

	//if there was init value before, dont overwrite it
	if (typeof obj.___initState[prop] !== 'undefined'){
		return;
	}

	obj.___initState[prop] = G.Utils.getObjProp(obj,prop);

};

G.Modify.prototype.updateKeyboard = function() {

	var obj = this.getCurrentObject();

	if(!obj) return;

	this.keys.frameCounter++;


	
	var val = 1;
	var proc = true;
	if (this.keys.Z.isDown){
		if (this.keys.frameCounter % 5 != 0) {
			proc = false;
		}
	}


	//position
	
	if (this.keys.X.isDown) {
		val = 5;
	}
	if (this.keys.C.isDown) {
		val = 20;
	}

	if (proc && this.keys.UP.isDown) {
		this.modifyCurrentObjProp('y',obj.y-val);
		//obj.position.y-=val;
	}
	if (proc && this.keys.DOWN.isDown) {
		this.modifyCurrentObjProp('y',obj.y+val);
		//obj.position.y+= val;
	}
	if (proc && this.keys.LEFT.isDown) {
		this.modifyCurrentObjProp('x',obj.x-val);
		//obj.position.x-=val;
	}
	if (proc && this.keys.RIGHT.isDown) {
		this.modifyCurrentObjProp('x',obj.x+val);
		//obj.position.x+= val;
	}

	

	val = 0.025;

	if (this.keys.X.isDown) {
		val = 0.05;
	}
	if (this.keys.C.isDown) {
		val = 0.1;
	}

	if (proc && this.keys.NUM8.isDown) {
		this.modifyCurrentObjProp('scale.y',obj.scale.y+val);
		//obj.scale.y+=val;
	}
	if (proc && this.keys.NUM2.isDown) {
		this.modifyCurrentObjProp('scale.y',obj.scale.y-val);
		obj.scale.y-= val;
	}
	if (proc && this.keys.NUM4.isDown) {
		this.modifyCurrentObjProp('scale.x',obj.scale.x-val);
		//obj.scale.x-=val;
	}
	if (proc && this.keys.NUM6.isDown) {
		this.modifyCurrentObjProp('scale.x',obj.scale.x+val);
		//obj.scale.x+= val;
	}

	if (proc && this.keys.PLUS.isDown) {
		this.modifyCurrentObjProp('scale.x',obj.scale.x+val);
		this.modifyCurrentObjProp('scale.y',obj.scale.y+val);
		//obj.scale.x += val;
		//obj.scale.y += val;
	}
	if (proc && this.keys.MINUS.isDown) {
		this.modifyCurrentObjProp('scale.x',obj.scale.x-val);
		this.modifyCurrentObjProp('scale.y',obj.scale.y-val);
		//obj.scale.x -= val;
		//obj.scale.y -= val;
	}

	//obj.scale.x = parseFloat(obj.scale.x.toFixed(3));
	//obj.scale.y = parseFloat(obj.scale.y.toFixed(3));
	


	//angle


	val = 1;

	if (this.keys.X.isDown) {
		val = 2;
	}
	if (this.keys.C.isDown) {
		val = 5;
	}

	if (proc && this.keys.NUM7.isDown) {
		this.modifyCurrentObjProp('angle',obj.angle-val);
		//obj.angle+=val;
	}
	if (proc && this.keys.NUM9.isDown) {
		this.modifyCurrentObjProp('angle',obj.angle+val);
		//obj.angle-= val;
	}


	if (this.keys.SPACE.isDown) {

		this.modifyCurrentObjProp('x',Math.floor(obj.x/5)*5);
		this.modifyCurrentObjProp('y',Math.floor(obj.y/5)*5);

		this.modifyCurrentObjProp('scale.x',Math.floor(obj.scale.x/0.025)*0.025);
		this.modifyCurrentObjProp('scale.y',Math.floor(obj.scale.y/0.025)*0.025);

		this.modifyCurrentObjProp('angle',Math.floor(obj.angle));

	}


};

G.Modify.prototype.currentLevelGoUp = function(){
	
	//that means that we are on the top
	if (this.currentLevel.parent == game.stage) return;
	this.changeLevelObject(this.currentLevel.parent);

};

//new stuff
G.Modify.prototype.changeLevelObject = function(obj){

	this.currentLevel = obj;
	//this.childrenPropNames = this.getChildrenPropNames();
	this.onLevelObjChange.dispatch(obj);
	this.changeCurrentObject(this.currentLevel.children[0]);

};

//new stuff
G.Modify.prototype.changeCurrentObject = function(obj){

	if (!obj) return;

	this.currentObject = obj;
	this.onCurrentObjChange.dispatch();

};






G.Modify.prototype.changeCurrentChildrenIndex = function(change) {

	if (!this.currentObject) return;

	var index = this.currentLevel.children.indexOf(this.currentObject)+change;

	if (index < 0) {
		index = this.currentLevel.children.length-1;
	}
	if (index >= this.currentLevel.children.length) {
		index = 0;
	}

	//check if it is not modify
	if (this.currentLevel.children[index] == this){
		index = change > 0 ? 0 : index+change;
	}

	//check if it even has a child
	if (this.currentLevel.children[index]){
		this.changeCurrentObject(this.currentLevel.children[index]);
	}

};




G.Modify.prototype.processClick = function(){

	var pointer = game.input.activePointer;
	if (this.keys.M.isDown) {
		this.moveCurrentObjectToWorldPos(pointer.x,pointer.y);
	}

};


G.Modify.prototype.moveCurrentObjectToWorldPos = function(x,y){

		console.log(x,y);

		var obj = this.getCurrentObject(); 
		if (!obj) return;

		obj.updateTransform();

		var offsetX = x - obj.worldPosition.x;
		var offsetY = y - obj.worldPosition.y;

		var offset = new Phaser.Point(offsetX,offsetY);
		var pointer = new Phaser.Point(x,y);
		offset.normalize();

		var dist = obj.worldPosition.distance(pointer);

		while (true){

			var prev = dist;

			obj.x += offset.x;
			obj.y += offset.y;
			obj.updateTransform();

			var dist = obj.worldPosition.distance(pointer);

			if (dist > prev) break;

		}

		obj.x = Math.floor(obj.x);
		obj.y = Math.floor(obj.y);

};

G.Modify.prototype.moveCurrentObjectToWorldPos = function(targetX,targetY){

	if (!this.currentObject) return;

	var toLocal = this.currentLevel.toLocal({x:targetX,y:targetY});
	this.modifyCurrentObjProp('x',Math.floor(toLocal.x));
	this.modifyCurrentObjProp('y',Math.floor(toLocal.y));

};

G.Modify.prototype.worldPosToLocal

G.Modify.prototype.addMouseWheel = function(){

	function mouseWheel(event) { 
			
		var lvlObj = this.getCurrentLevelObject();
		if (lvlObj && lvlObj !== game.world) {
			lvlObj.y += game.input.mouse.wheelDelta * 150;
		}
			
	}

	game.input.mouse.mouseWheelCallback = mouseWheel.bind(this);

};


G.Modify.prototype.exportLvlAsString = function(){

	var exportObj = [];

	var lvl = this.getCurrentLevelObject();

	for (var i = 0; i < lvl.children.length; i++) {

		var child = lvl.children[i];

		if (!(child instanceof Phaser.Image)) continue;

		var frameName = null;
		if (typeof child.frameName === 'string') {
			if (child.frameName.indexOf('/') == -1) {
				frameName = child.frameName;
			}else {
				frameName = child.key;
			}
		}


		var childObj = {
			x: child.x,
			y: child.y,
			frame: frameName,
			anchor: [child.anchor.x,child.anchor.y],
			scale: [child.scale.x,child.scale.y],
			angle: child.angle
		};

		if (child.___LABEL) {
			childObj.label = child.___LABEL;
		}

		if (child.___DATA) {
			childObj.data = child.___DATA;
		}

		exportObj.push(childObj);

	};

	console.log(JSON.stringify(exportObj));

	G.Utils.copyToClipboard(JSON.stringify(exportObj));

};

G.Modify.prototype.objToTop = function(){

	if (this.currentObject){
		this.currentLevel.bringToTop(this.currentObject);
	}
	this.refreshLevel();

}; 

G.Modify.prototype.objMoveUp = function(){

	if (this.currentObject){
		this.currentLevel.moveUp(this.currentObject);
	}
	this.refreshLevel();

};

G.Modify.prototype.objMoveDown = function(){

	if (this.currentObject){
		this.currentLevel.moveDown(this.currentObject);
	}
	this.refreshLevel();

};

G.Modify.prototype.objToBottom = function(){

	if (this.currentObject){
		this.currentLevel.sendToBack(this.currentObject);
	}
	this.refreshLevel();

};



//TO DO

G.Modify.prototype.childPropChange = function(currentLevel) {

	var orgLevel = this.currentLevel;
	var orgIndex = this.currentChildIndex;

	this.currentLevel = currentLevel || [];

	var currentLevelTxt = this.currentLevel.join('/') || (this.currentLevel[0] || game.state.current);

	var removeStr = this.removeCashObjToString(currentLevelTxt);

	var exportStr = '';

	var childrenPropNames = this.getChildrenPropNames();

	for (var i = 0; i < childrenPropNames.length; i++) {
		this.currentChildIndex = i;
		var obj = this.getCurrentObject();

		if (obj === this) continue;

		var currentChildPropTxt = childrenPropNames[i].toString();

		var fresh = obj.___NEWOBJECT;
		var isText = obj.constructor === G.OneLineText || obj.constructor === G.MultiLineText;

		if (fresh) {
			exportStr += 'NEW OBJECT \n';
			/*if (obj.___IMAGE) {
				exportStr += this.generateImageCode(currentChildPropTxt,obj);
			}*/
		}

		if (obj.___initState) {

			exportStr += '\t'+childrenPropNames[i]+'\n';

			var keys = Object.keys(obj.___initState);

			keys.forEach(function(key){
				exportStr += '\t'+key+':  '+G.Utils.getObjProp(obj,key)+'\n';
			},this);

			obj.___initState = undefined;

		}

		if (!isText && (fresh || obj.children && obj.children.length > 0)) {
			this.childPropChange(this.currentLevel.concat(childrenPropNames[i]));
		}


	};

	if (exportStr.length > 0 || removeStr.length > 0) {

		if (removeStr.length > 0) removeStr+'\n'
		if (exportStr.length > 0) exportStr+'\n'
		this.export += currentLevelTxt+'\n'+removeStr+exportStr;

	}

	this.currentChildIndex = orgIndex;
	this.currentLevel = orgLevel;

};

G.Modify.prototype.exportChanges = function() {

	this.export = '';;
	this.childPropChange();

	if (this.export) {

		this.export = this.objectName+'\n'+this.export;
		G.Utils.copyToClipboard(this.export);
		console.log(this.export);
	}else{
		console.log('NO CHANGES TO EXPORT');
	}

};
G.ModifyButtonGroup = function() {

    Phaser.Group.call(this, game);

    this.modify = G.Modify.instance;

    this.fixedToCamera = true;

    this.gfx = this.add(game.add.graphics());

    this.transformButtons = this.add(game.add.group());
    this.changeObjButtons = this.add(game.add.group());

    this.mode = 0;

    this.tabKey = game.input.keyboard.addKey(Phaser.Keyboard.TAB);
    this.tabKey.onDown.add(function() {
        this.gfx.clear();
        this.mode = (this.mode + 1) % 2;
        this.transformButtons.visible = this.mode == 0;
        this.changeObjButtons.visible = this.mode == 1;
    }, this);

    this.keys = {
        ALT: game.input.keyboard.addKey(Phaser.Keyboard.ALT)
    }



    this.clickedButton = null;
    this.clickedPos = null;



    this.posButton = game.add.button(0, 0, null);
    this.posButton.onInputDown.add(function() {
        this.clickedButton = this.posButton;
        this.clickedPos = { x: game.input.activePointer.x, y: game.input.activePointer.y };
    }, this);
    this.posButton.anchor.setTo(0.5, 0.5);
    this.posButton.tint = 0xff0000;
    this.transformButtons.add(this.posButton);

    this.scaleButton = game.add.button(0, 0, null);
    this.scaleButton.onInputDown.add(function() {
        this.clickedButton = this.scaleButton;
        this.clickedPos = { x: game.input.activePointer.x, y: game.input.activePointer.y };
    }, this);
    this.scaleButton.anchor.setTo(0.5, 0.5);
    this.scaleButton.tint = 0x00ff00;
    this.transformButtons.add(this.scaleButton);


    this.rotateButton = game.add.button(0, 0, null);
    this.rotateButton.onInputDown.add(function() {
        this.clickedButton = this.rotateButton;
        this.clickedPos = { x: game.input.activePointer.x, y: game.input.activePointer.y };
    }, this);
    this.rotateButton.anchor.setTo(0.5, 0.5);
    this.rotateButton.tint = 0x00ff00;
    this.transformButtons.add(this.rotateButton);

    this.refreshChangeObjButtons();

    this.modify.onLevelObjChange.add(this.refreshChangeObjButtons, this);
    this.modify.onObjDestroy.add(this.refreshChangeObjButtons, this);

};

G.ModifyButtonGroup.prototype = Object.create(Phaser.Group.prototype);

G.ModifyButtonGroup.prototype.update = function() {

    if (this.mode == 0) {
        this.updateTransformButtons();
   		this.transformButtons.ignoreChildInput = false;
        this.changeObjButtons.ignoreChildInput = true;
    } else {
    	this.transformButtons.ignoreChildInput = true;
        this.changeObjButtons.ignoreChildInput = false;
        this.updateChangeObjButtons();
    };

};

G.ModifyButtonGroup.prototype.updateTransformButtons = function() {

    var obj = this.modify.getCurrentObject();
    if (!obj) {
        this.posButton.position.setTo(-9999, -9999);
        this.scaleButton.position.setTo(-9999, -9999);
        this.rotateButton.position.setTo(-9999, -9999);
        return;
    };
    var bounds = obj.getBounds();
    var localBounds = obj.getLocalBounds();
    var pointer = game.input.activePointer

    this.posButton.x = obj.worldPosition.x;
    this.posButton.y = obj.worldPosition.y;

    this.scaleButton.x = obj.worldPosition.x + localBounds.x * obj.scale.x + bounds.width * obj.scale.x + 20,
        this.scaleButton.y = obj.worldPosition.y + localBounds.y * obj.scale.y + bounds.height * obj.scale.y + 20;

    this.rotateButton.x = obj.worldPosition.x + localBounds.x * obj.scale.x - 20;
    this.rotateButton.y = obj.worldPosition.y + localBounds.y * obj.scale.y - 20;



    this.gfx.clear();

    this.gfx.lineStyle(1, 0x000000, 1);
    this.gfx.beginFill(0xff0000, 1);
    this.gfx.drawCircle(this.posButton.worldPosition.x, this.posButton.worldPosition.y, 10);
    this.gfx.endFill();

    this.gfx.beginFill(0x00ff00, 1);
    this.gfx.drawCircle(this.scaleButton.worldPosition.x, this.scaleButton.worldPosition.y, 10);
    this.gfx.endFill();

    this.gfx.beginFill(0x0000ff, 1);
    this.gfx.drawCircle(this.rotateButton.worldPosition.x, this.rotateButton.worldPosition.y, 10);
    this.gfx.endFill();


    if (!this.clickedButton) return;

    if (pointer.isDown) {
        var offsetX = pointer.x - this.clickedPos.x;
        var offsetY = pointer.y - this.clickedPos.y;

        if (this.clickedButton === this.posButton) {
            this.modify.modifyCurrentObjProp('x', obj.x + offsetX);
            this.modify.modifyCurrentObjProp('y', obj.y + offsetY);
        }

        if (this.clickedButton === this.scaleButton) {
            this.modify.modifyCurrentObjProp('width', obj.width + offsetX);
            this.modify.modifyCurrentObjProp('height', obj.height + offsetY);
            if (this.keys.ALT.isDown) {
                //obj.scale.y = obj.scale.x;
                this.modify.modifyCurrentObjProp('scale.y', obj.scale.x);
            }
        }

        if (this.clickedButton === this.rotateButton) {
            this.modify.modifyCurrentObjProp('angle', obj.angle + offsetX * 0.25);
            //obj.angle += offsetX*0.25;

        }

        this.clickedPos = { x: game.input.activePointer.x, y: game.input.activePointer.y };
    } else {
        this.modify.modifyCurrentObjProp('x', Math.floor(obj.x / 5) * 5);
        this.modify.modifyCurrentObjProp('y', Math.floor(obj.y / 5) * 5);
        this.modify.modifyCurrentObjProp('scale.x', Math.floor(obj.scale.x / 0.025) * 0.025);
        this.modify.modifyCurrentObjProp('scale.y', Math.floor(obj.scale.y / 0.025) * 0.025);
        this.modify.modifyCurrentObjProp('angle', Math.floor(obj.angle));
        this.clickedButton = null;
    }



};

G.ModifyButtonGroup.prototype.updateChangeObjButtons = function() {

    this.gfx.clear();
    this.gfx.beginFill(0x00ff00, 1);
    this.gfx.lineStyle(3, 0xff0000, 1)

    for (var i = 0; i < this.changeObjButtons.length; i++) {
        var child = this.changeObjButtons.children[i];
        this.gfx.drawCircle(child.worldPosition.x, child.worldPosition.y, 10);
    }

};

G.ModifyButtonGroup.prototype.refreshChangeObjButtons = function() {

    this.changeObjButtons.removeAll(true);

    var currentLevel = this.modify.getCurrentLevelObject();

    for (var i = 0; i < currentLevel.children.length; i++) {

        if (currentLevel.children[i] == this.modify) continue;

        var child = currentLevel.children[i];
        var btn = game.make.button(0, 0, null);
        this.changeObjButtons.add(btn);
        btn.attachement = child;
        btn.modify = this.modify;
        btn.position = child.worldPosition;
        btn.hitArea = new Phaser.Circle(0, 0, 10);
        btn.onInputDown.add(function() {
            this.modify.setNewCurrentChildren(this.attachement);
        }, btn);

    }

};

G.ModifyCodeGenerator = function(modify){

	this.modify = modify;

};


G.ModifyCodeGenerator.prototype.start = function(obj){

	this.constStr = '';
	var exeStr = this.generateCode(obj);

	var endStr = this.constStr+'\n\n'+exeStr;

	G.Utils.copyToClipboard(endStr);
	console.log(endStr);

};


G.ModifyCodeGenerator.prototype.generateCode = function(obj,prefix){

	if (G.OneLineText) {
		if (obj instanceof G.OneLineText) {
			return this.generateCodeOneLineText(obj,prefix);
		}
	}

	if (G.MultiLineText){
		if (obj instanceof G.MultiLineText) {
			return this.generateCodeMultiLineText(obj,prefix);
		}
	}

	if (G.Button){
		if (obj instanceof G.Button){
			return this.generateCodeButton(obj,prefix);
		}
	}

	if ((obj instanceof Phaser.Group) && !(obj instanceof Phaser.BitmapText)){
		if (obj.___CONSTRUCTOR) {
			return this.generateConstructorCode(obj,prefix);
		}else {
			return this.generateGroupCode(obj,prefix);
		}
	}

	
	return this.generateCodeImage(obj,prefix);
		
};

G.ModifyCodeGenerator.prototype.generateConstructorCode = function(obj,prefix,inside){

	var name = this.getObjName(obj);

	var capName = G.capitalize(name);

	var constStr = '';

	constStr += 'G.'+capName+' = function(x,y){\n';
	constStr +=	'\tPhaser.Group.call(this,game);\n';
	constStr += '\tthis.position.setTo(x,y);\n';
	constStr += this.generateCodeUniProp(obj,'this');
	constStr += '\n';

	for (var i = 0; i < obj.children.length; i++){
		constStr += '\t'+this.generateCode(obj.children[i],'this');
		constStr += '\n';
	}

	constStr += '};\n';
	constStr += 'G.'+capName+'.prototype = Object.create(Phaser.Group.prototype);\n\n';

	this.constStr += constStr;

	var exeStr = (prefix ? prefix+'.' : 'var ') +'%NAME% = new G.'+capName+'(^x^,^y^);\n';
	if (prefix) {
		exeStr += prefix+'.add('+prefix+'.%NAME%);\n';
	}
	exeStr = G.Utils.replaceAll(exeStr,'%NAME%',name);
	exeStr = this.injectObjPropToString(obj,exeStr);

	return exeStr;

};

G.ModifyCodeGenerator.prototype.generateGroupCode = function(obj,prefix) {

	var name = this.getObjName(obj);

	var str = (prefix ? prefix+'.' : 'var ') +'%NAME% = game.add.group();\n';
	str += (prefix ? prefix+'.' : '')+'%NAME%.position.setTo(^x^,^y^);\n';
	str += this.generateCodeUniProp(obj,prefix);

	if (prefix) {
		str += prefix+'.add('+prefix+'.%NAME%);\n';
	}

	for (var i = 0; i < obj.children.length; i++){
		var childStr = this.generateCode(obj.children[i],(prefix ? prefix+'.' : '')+name,true);
		str += G.Utils.replaceAll(childStr,'this','%NAME%');
	}

	str = G.Utils.replaceAll(str,'%NAME%',name);
	return this.injectObjPropToString(obj,str);
}

G.ModifyCodeGenerator.prototype.generateGroupConstructor = function(obj){



};

G.ModifyCodeGenerator.prototype.generateChildrensCode = function(obj){


};

G.ModifyCodeGenerator.prototype.generateCodeButton = function(obj,prefix){

	prefix = prefix || '';

	var str = '';
	str += (prefix ? prefix+'.' : 'var ') +"%NAME% = new G.Button(^x^,^y^,'^frameName^',function(){},this);\n"; 
	str += (prefix ? prefix+'.' : '')+'add('+(prefix ? prefix+'.' : 'var ')+'%NAME%);\n';
	str += this.generateCodeUniProp(obj,prefix);
	str = G.Utils.replaceAll(str,'%NAME%',this.getObjName(obj));
	return this.injectObjPropToString(obj,str);

};

G.ModifyCodeGenerator.prototype.generateCodeImage = function(obj,prefix){

	var str = '';
	str += (prefix ? prefix+'.' : 'var ') +"%NAME% = G.makeImage(^x^,^y^,'^frameName^',[^anchor.x^,^anchor.y^],"+prefix+");\n";
	str += this.generateCodeUniProp(obj,prefix);
	str = G.Utils.replaceAll(str,'%NAME%',this.getObjName(obj));
	return this.injectObjPropToString(obj,str);

};

G.ModifyCodeGenerator.prototype.generateCodeOneLineText = function(obj,prefix){

	var str = '';
	str += (prefix ? prefix+'.' : 'var ') + "%NAME% = new G.OneLineText(^x^,^y^,'^font^','^text^',^fontSize^,^maxUserWidth^,^anchor.x^,^anchor.y^);\n";
	str += (prefix ? prefix+'.' : '')+'add('+(prefix ? prefix+'.' : 'var ')+'%NAME%);\n';
	str += this.generateCodeUniProp(obj,prefix);
	str = G.Utils.replaceAll(str,'%NAME%',this.getObjName(obj));
	return this.injectObjPropToString(obj,str);

};

G.ModifyCodeGenerator.prototype.generateCodeMultiLineText = function(obj,prefix){

	var str = '';	
	str +=  (prefix ? prefix+'.' : 'var ') + "%NAME% = new G.MultiLineText(^x^,^y^,'^font^','^text^',^fontSize^,^maxUserWidth^,^maxUserHeight^,'^align^',^anchor.x^,^anchor.y^);\n";
	str += (prefix ? prefix+'.' : '')+'add('+(prefix ? prefix+'.' : 'var ')+'%NAME%);\n';
	str += this.generateCodeUniProp(obj,prefix);
	str = G.Utils.replaceAll(str,'%NAME%',this.getObjName(obj));
	return this.injectObjPropToString(obj,str);

};


G.ModifyCodeGenerator.prototype.getObjName = function(obj){

	if (obj.___LABEL){
		return obj.___LABEL;
	}else{
		var name = prompt('enter name');
		obj.___LABEL = name;
		return name;
	}

};

G.ModifyCodeGenerator.prototype.generateCodeUniProp = function(obj,prefix){

	var str = '';
	prefix = prefix ? prefix+'.' : '';

	if (obj.scale.x !== 1 || obj.scale.y !== 1){
		str += prefix+'%NAME%.scale.setTo(^scale.x^, ^scale.y^);\n';
	}

	if (obj.angle !== 0){
		str += prefix+'%NAME%.angle = ^angle^;\n';
	}

	if (obj.alpha !== 1){
		str += prefix+'%NAME%.alpha = ^alpha^;\n';
	}

	if (obj.fixedToCamera){
		str += prefix+'%NAME%.fixedToCamera = true;\n';
		str += prefix+'%NAME%.cameraOffset.setTo(^cameraOffset.x^,^cameraOffset.y^);\n';
	}

	return str;

};


G.ModifyCodeGenerator.prototype.injectObjPropToString = function(obj,str){

	while (true){

		var firstIndex = str.indexOf('^');
		var secondIndex = str.indexOf('^',firstIndex+1);

		if (firstIndex == -1){
			break;
		}

		var toReplace = str.slice(firstIndex,secondIndex+1);
		var propToGet = str.slice(firstIndex+1,secondIndex);

		str = str.replace(toReplace,G.Utils.getObjProp(obj,propToGet));


	};

	return str;

};
G.ModifyInputBlocked = function(){

	Phaser.Graphics.call(this,game,0,0);

	this.beginFill(0xff0000,0.0001);
	this.drawRect(0,0,5000,4000);
	this.inputEnabled=true;
	this.events.onInputDown.add(function(){});
	this.fixedToCamera = true;

};

G.ModifyInputBlocked.prototype = Object.create(Phaser.Graphics.prototype);
G.ModifyObjectFactory = function(modify){

	G.Utils.injectCSS(this.cssClasses.join('\n'));

	this.modify = modify;

	this.mainDiv = document.createElement('div');
	this.domUl = document.createElement('ul');
	this.domUl.className = 'modifyOFul';
	this.mainDiv.appendChild(this.domUl);

	this.addLiButtons([
		['+GROUP',this.addGroup],
		['+IMG',this.addImage],
		['+OneLineTXT',this.addOneLineText],
		['+MulitLineTXT',this.addMultiLineText],
		['+BTN',this.addButton],
		['-REMOVE',this.modify.removeObject],
		['EXPORT LVLOBJ STR',this.modify.exportLvlAsString]
	]);

	this.defaultNewObjectsNames = true;

	this.onObjectAdded = new Phaser.Signal();

};

G.ModifyObjectFactory.prototype.cssClasses = [
	'.modifyOFul {padding: 0px; margin: 0px;}',
	'.modifyOFli {display: inline; list-style-type: none;}'
];

G.ModifyObjectFactory.prototype.addLiButtons = function(list){

	list.forEach(function(btnList){

		var li = this.createLiButton(btnList);
		this.domUl.appendChild(li);

	},this);

};

G.ModifyObjectFactory.prototype.createLiButton = function(btnData){

	var li = document.createElement('li');
	li.className = 'modifyOFli';

	var button = document.createElement('button');

	button.innerHTML = btnData[0];
	button.onclick = btnData[1].bind(this);

	li.appendChild(button);

	return li;

};

G.ModifyObjectFactory.prototype.addToGroup = function(parent,obj) {

	if (parent == game.world || parent == game.state.getCurrentState()) {
		parent = game.world;
		obj.x = game.camera.x+game.width*0.5;
		obj.y = game.camera.y+game.height*0.5;
	}
	if (parent.add) {
		parent.add(obj);
	}else if (parent.addChild) {
		parent.addChild(obj);
	}

	var name;

	var lvlObj = this.modify.currentLevel;

	if (this.defaultNewObjectsNames){
		name = 'child_'+lvlObj.children.length;
	}else {
		name = prompt('Enter object name');
	}

	if (name) {

		obj.___LABEL = name;
		if (parent == game.world) {
			game.state.getCurrentState()[name] = obj;
		}else {
			parent[name] = obj;
		}
	}

	this.onObjectAdded.dispatch(obj);

};

G.ModifyObjectFactory.prototype.addGroup = function() {

	var obj = this.modify.currentLevel;
	var group = game.make.group();
	group.___NEWOBJECT = true;
	this.addToGroup(obj,group);

	return group;

};

G.ModifyObjectFactory.prototype.addImage = function() {

	var obj = this.modify.currentLevel;
	var image = new G.Image(0,0,'__missing',0.5,null);
	image.___NEWOBJECT = true;
	this.addToGroup(obj,image);

	return image;

};


G.ModifyObjectFactory.prototype.addButton = function(){

	var obj = this.modify.currentLevel;
	var button = new G.Button(0,0,'__missing',function(){},this);
	button.___NEWOBJECT = true;
	this.addToGroup(obj,button);

	return button;

};

G.ModifyObjectFactory.prototype.addOneLineText = function() {

	var obj = this.modify.currentLevel;

	var fonts = Object.keys(game.cache._cache.bitmapFont);
	var txt = new G.OneLineText(0,0,fonts[0],'TEXT',50,300,0.5,0.5);
	txt.cacheAsBitmap= false;
	this.addToGroup(obj,txt);

	return txt;
};

G.ModifyObjectFactory.prototype.addMultiLineText = function() {

	var obj = this.modify.currentLevel;

	var fonts = Object.keys(game.cache._cache.bitmapFont);
	var txt = new G.MultiLineText(0,0,fonts[0],'TEXT',50,300,300,'center',0.5,0.5);
	txt.cacheAsBitmap= false;
	this.addToGroup(obj,txt);

	return txt;

};
G.ModifyDOMButtonGroup = function(modify){

	this.modify = modify;


	this.posBtn = document.createElement('div');
	this.posBtn.style.width = '10px';
	this.posBtn.style.height = '10px';
	this.posBtn.style.position = 'fixed';
	this.posBtn.style.backgroundColor = 'red';
	this.posBtn.draggable = 'true';
	this.posBtn.ondrag = this.posDragHandler.bind(this);
	this.posBtn.style.border = '1px solid';
	//this.posBtn.style.transform = 'translateX(-50%) translateY(-50%)';
	document.body.appendChild(this.posBtn);

	this.scaleBtn = document.createElement('div');
	this.scaleBtn.style.width = '10px';
	this.scaleBtn.style.height = '10px';
	this.scaleBtn.style.position = 'fixed';
	this.scaleBtn.style.backgroundColor = 'green';
	this.scaleBtn.draggable = 'true';
	this.scaleBtn.onclick = function(){console.log('click')};
	this.scaleBtn.ondrag = this.scaleDragHandler.bind(this);
	this.scaleBtn.ondragstart = function(){console.log('ondragstart')};
	this.scaleBtn.style.border = '1px solid';
	//this.scaleBtn.style.transform = 'translateX(-50%) translateY(-50%)';
	document.body.appendChild(this.scaleBtn);

	this.angleBtn = document.createElement('div');
	this.angleBtn.style.width = '10px';
	this.angleBtn.style.height = '10px';
	this.angleBtn.style.position = 'fixed';
	this.angleBtn.style.backgroundColor = 'blue';
	this.angleBtn.draggable = 'true';
	this.angleBtn.ondrag = this.angleDragHandler.bind(this);
	this.angleBtn.style.border = '1px solid';
	//this.angleBtn.style.transform = 'translateX(-50%) translateY(-50%)';
	document.body.appendChild(this.angleBtn); 
	

	this.bindedUpdateTransformButtons = this.updateTransformButtons.bind(this);

	window.requestAnimationFrame(this.bindedUpdateTransformButtons);

};

G.ModifyDOMButtonGroup.prototype.updateTransformButtons = function(){


	if (!this.dragging){

		var obj = this.modify.currentObject;

		if (obj){

			
			var bounds = obj.getBounds();
			

			this.posBtn.style.display = 'block';
			this.posBtn.style.left = G.Utils.toClientX(obj.worldPosition.x)+'px';
			this.posBtn.style.top = G.Utils.toClientY(obj.worldPosition.y)+'px';



			this.scaleBtn.style.display = 'block';
			//this.scaleBtn.style.left = G.Utils.toClientX(obj.worldPosition.x+(obj.width*obj.worldScale.x))+'px';
			//this.scaleBtn.style.top = G.Utils.toClientY(obj.worldPosition.y+(obj.height*obj.worldScale.y))+'px';

			

			var lb = obj.getLocalBounds();
			var anchorXFromLocalBounds = lb.x/lb.width*-1;
			var anchorYFromLocalBounds = lb.y/lb.height*-1;
			


			var bounds = obj.getBounds();


			var xx = bounds.x+(bounds.width*anchorXFromLocalBounds)+(bounds.width*(1-anchorXFromLocalBounds)*Math.sign(obj.worldScale.x));
			var yy = bounds.y+(bounds.height*anchorYFromLocalBounds)+(bounds.height*(1-anchorYFromLocalBounds)*Math.sign(obj.worldScale.y));

			this.scaleBtn.style.left = G.Utils.toClientX(xx)+'px';
			this.scaleBtn.style.top = G.Utils.toClientY(yy)+'px';


			var s = Math.sin(obj.worldRotation);
			var c = Math.cos(obj.worldRotation);
			var tx = c*25;
			var ty = s*25;

			this.angleBtn.style.display ='block';
			this.angleBtn.style.left = G.Utils.toClientX(obj.worldPosition.x+tx)+'px';
			this.angleBtn.style.top = G.Utils.toClientY(obj.worldPosition.y+ty)+'px';



		}else{
			this.posBtn.style.display = 'none';
			this.scaleBtn.style.display = 'none';
		}

	}

	window.requestAnimationFrame(this.bindedUpdateTransformButtons);

};


G.ModifyDOMButtonGroup.prototype.posDragHandler = function(event){


	var obj = this.modify.currentObject;

	if (obj){

		//because on drop handler will fire at 0,0
		if (event.pageX == 0 && event.pageY == 0){
			return;
		}

		this.modify.moveCurrentObjectToWorldPos(
			G.Utils.clientXToWorldX(event.clientX),
			G.Utils.clientYToWorldY(event.clientY));

	}

};



G.ModifyDOMButtonGroup.prototype.scaleDragHandler = function(event){


	var obj = this.modify.currentObject;

	if (obj){

		if(!this.prevScalePosition){
			this.prevScalePosition = {x: event.clientX, y: event.clientY};
			return;
		}

		//because on drop handler will fire at 0,0
		if (event.pageX == 0 && event.pageY == 0){
			this.prevScalePosition = false;

			if (event.shiftKey){
				obj.scale.y = obj.scale.x;
			}

			this.modify.modifyCurrentObjProp('width',Math.floor(obj.width));
			this.modify.modifyCurrentObjProp('height',Math.floor(obj.height));

			return;
		}



		var xdiff = event.clientX-this.prevScalePosition.x;
		var ydiff = event.clientY-this.prevScalePosition.y;

		this.modify.modifyCurrentObjProp('width',obj.width+xdiff);
		this.modify.modifyCurrentObjProp('height',obj.height+ydiff);

		if (event.shiftKey){
				obj.scale.y = obj.scale.x;
				this.modify.modifyCurrentObjProp('width',Math.floor(obj.width));
				this.modify.modifyCurrentObjProp('height',Math.floor(obj.height));
		}

		this.prevScalePosition.x = event.clientX;
		this.prevScalePosition.y = event.clientY;


	}

};


G.ModifyDOMButtonGroup.prototype.angleDragHandler = function(event){


	var obj = this.modify.currentObject;

	if (obj){

		if(!this.prevAnglePosition){
			this.prevAnglePosition = {x: event.clientX, y: event.clientY};
			return;
		}

		//because on drop handler will fire at 0,0
		if (event.pageX == 0 && event.pageY == 0){
			this.prevAnglePosition = false;
			return;
		}


		var rotation = game.math.angleBetween(
				G.Utils.toClientX(obj.worldPosition.x),
				G.Utils.toClientY(obj.worldPosition.y),
				event.clientX,
				event.clientY
				)-obj.parent.worldRotation;

		this.modify.modifyCurrentObjProp('rotation',rotation);

		this.prevAnglePosition.x = event.clientX;
		this.prevAnglePosition.y = event.clientY;


	}

};


G.ModifyDOMButtonGroup.prototype.destroy = function(){

	this.scaleBtn.remove();
	this.posBtn.remove();

};
G.ModifyDOMChildList = function(modify){

	G.Utils.injectCSS(this.cssClasses.join('\n'));

	this.modify = modify;

	this.mainDiv = document.createElement('div');
	this.mainDiv.className = 'modifyCLmainDiv';
	document.body.append(this.mainDiv);


	this.goToTopBtn = document.createElement('button');
	this.goToTopBtn.className = 'modifyCLButton modifyCLButtonLevel';
	this.goToTopBtn.innerHTML = 'T';
	this.goToTopBtn.onclick = function(){
		modify.currentLevelGoUp();
	};

	this.levelSpan = document.createElement('span');
	this.levelSpan.className = 'modifyCLlevelSpan';

	this.mainDiv.appendChild(this.goToTopBtn);
	this.mainDiv.appendChild(this.levelSpan);

	this.list = document.createElement('ul');
	this.list.style.display = 'block';
	this.list.className = 'modifyCLul';
	this.mainDiv.appendChild(this.list);

	this.modify.onLevelObjChange.add(this.refreshList,this);
	this.modify.onCurrentObjChange.add(this.highlightCurrent,this);
	this.modify.onObjDestroy.add(this.refreshList,this);
};


G.ModifyDOMChildList.prototype.cssClasses = [
	'.modifyCLlevelSpan {font-weight: bold; font-size: 0.7em;}',
	//'.modifyCLmainDiv {position: fixed; top: 0; font-family: verdana; left: 0; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none;}',
	'.modifyCLmainDiv {font-family: verdana; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none;}',
	'.modifyCLButton {pointer-events: all; margin: 0; border: 0; background-color: rgba(200,200,200,0.5); font-weight: bold; font-size: 0.7em;}',
	'.modifyCLButtonSelection {background-color: rgba(255,255,255,1)}',
	'.modifyCLButtonLevel {background-color: rgba(0,0,200,0.5)}',
	'.modifyCLButtonLevelHasChildren {background-color: rgba(0,200,0,0.5)}',
	'.modifyCLli {margin: 0; padding: 0;}',
	".modifyCLul {margin: 0; margin-top: 10px; padding: 0; line-style: none;}" 
];


G.ModifyDOMChildList.prototype.onCurrentObjChange = function(){};

G.ModifyDOMChildList.prototype.toggleList = function(){

	this.list.style.display = this.list.style.display == 'block' ? 'none' : 'block';

};

G.ModifyDOMChildList.prototype.highlightCurrent = function(){

	for (var i = 0; i < this.list.children.length; i++){
		var btn = this.list.children[i].children[0];
		if (this.modify.currentObject == btn.childData.obj){
			btn.className = 'modifyCLButton modifyCLButtonSelection';
		}else{
			btn.className = 'modifyCLButton';
		}
	}

};

G.ModifyDOMChildList.prototype.refreshList = function(obj){

	var childrenData = this.modify.getChildrenData(obj);

	this.levelSpan.innerHTML = this.modify.getChildLabel(obj);

	this.list.innerHTML = '';

	childrenData.forEach(function(childData){

		var childLi = this.createChildLi(childData);
		this.list.appendChild(childLi);

	},this);

	this.highlightCurrent();

};


G.ModifyDOMChildList.prototype.createChildLi = function(childData){
	//for closure
	var modify = this.modify;

	var li = document.createElement('li');
	li.className = 'modifyCLli';

	var btn = document.createElement('button');
	btn.className = 'modifyCLButton';
	btn.childData = childData;
	btn.onclick = function(){
		modify.changeCurrentObject(this.childData.obj);
	};

	li.appendChild(btn);

	btn.innerHTML = childData.label;

	if (childData.openable){

		var levelBtn = document.createElement('button');

		if (childData.hasChildren){
			levelBtn.className = 'modifyCLButton modifyCLButtonLevelHasChildren';
		}else{
			levelBtn.className = 'modifyCLButton modifyCLButtonLevel';
		}
		
		levelBtn.childData = childData;

		levelBtn.onclick = function(){
			modify.changeLevelObject(this.childData.obj);
		};

		levelBtn.innerHTML = '+';
		li.appendChild(levelBtn);

	}

	return li;

};
G.ModifyDOMFrameSelector = function(){

	G.Utils.injectCSS(this.css.join('\n'));

		var frameSelector = this;

	this.mainDiv = document.createElement('div');
	this.mainDiv.className = 'mDOMfsmain';
	this.mainDiv.style.backgroundColor = 'gray';

	document.body.appendChild(this.mainDiv);

	this.selectList = document.createElement('select');
	this.mainDiv.appendChild(this.selectList);

	this.plusBtn = document.createElement('button');
	this.plusBtn.innerHTML = '+';
	this.plusBtn.onclick = function(){
		frameSelector.changeImgBtnsSize(10);
	};
	this.mainDiv.appendChild(this.plusBtn);

	this.minusBtn = document.createElement('button');
	this.minusBtn.innerHTML = '-';
	this.minusBtn.onclick = function(){
		frameSelector.changeImgBtnsSize(-10);
	};
	this.mainDiv.appendChild(this.minusBtn);

	this.closeBtn = document.createElement('button');
	this.closeBtn.innerHTML = 'X';
	this.closeBtn.onclick = function(){
		frameSelector.close();
	}
	this.mainDiv.appendChild(this.closeBtn);

	this.pageContainer = document.createElement('div');
	this.pageContainer.className = 'mDOMpageContainer';
	this.mainDiv.appendChild(this.pageContainer);

	this.atlasPages = [];

	this.selectList.onchange = function(e){
		frameSelector.selectPage(this.value);
	};

	this.loadAtlases();

	this.selectPage('IMAGES');
	this.close();

	this.onFrameClicked = new Phaser.Signal();

};

G.ModifyDOMFrameSelector.prototype.css = [
	'.mDOMfsmain {position: fixed; top: 0; right: 0; height: 100%; width: 210px;}',
	'.mDOMpageContainer {height: 95%; overflow-y: scroll;}',
	'.mDOMpageContainer::-webkit-scrollbar {width: 5px;}',
	'.mDOMpageContainer::-webkit-scrollbar-track {-webkit-box-shadow: inset 0 0 6px rgba(0,0,0,0.3);}',
	'.mDOMpageContainer::-webkit-scrollbar-thumb {background-color: darkgrey; outline: 1px solid slategray;}'
];

G.ModifyDOMFrameSelector.prototype.toggle = function(){

	this.mainDiv.style.display = this.mainDiv.style.display == 'block' ? 'none' : 'block';

};

G.ModifyDOMFrameSelector.prototype.open = function(){
	this.mainDiv.style.display = 'block';
};

G.ModifyDOMFrameSelector.prototype.close = function(){
	this.mainDiv.style.display = 'none';
};

G.ModifyDOMFrameSelector.prototype.destroy = function(){

	this.mainDiv.remove();

};

G.ModifyDOMFrameSelector.prototype.changeImgBtnsSize = function(change){

	this.atlasPages.forEach(function(page){

		page.imgBtns.forEach(function(btn){

			var cs = parseInt(btn.style.width);
			var newSize = cs+change > 30 ? cs+change : 30;
			btn.style.width = newSize+'px';
			btn.style.height = newSize+'px';

		});

	});

};

G.ModifyDOMFrameSelector.prototype.selectPage = function(atlasName){

	this.atlasPages.forEach(function(page){
		page.style.display = page.atlasName === atlasName ? 'block' : 'none';
	});

};

G.ModifyDOMFrameSelector.prototype.loadAtlases = function(){

	var imgCache = game.cache._cache.image;

	this.makeAtlasPage('IMAGES');

	for (prop in imgCache){

		//skop default and missing
		if (prop[0] == '_' && prop[1] == '_') continue;

		//singleImg
		if (!imgCache[prop].frame){
			this.makeAtlasPage(prop);
		}

	}

};

G.ModifyDOMFrameSelector.prototype.makeAtlasPage = function(atlasName){

	var option = document.createElement('option');
	option.setAttribute('value',atlasName);
	option.innerHTML = atlasName;
	this.selectList.appendChild(option);

	var page = document.createElement('div');
	page.imgBtns = [];

	page.atlasName = atlasName;

	var frameNames;

	if (atlasName == 'IMAGES'){
		frameNames = {};

		var cache = game.cache._cache.image;
		for (imgKey in cache){
			if (imgKey.indexOf('__') == 0) continue;
			if (cache[imgKey].frame) {
				frameNames[imgKey] = true;
			}
		}

	}else{
		frameNames = game.cache.getFrameData(atlasName)._frameNames;
	}


	for (img in frameNames){
		var btn = this.makeImageBtn(img);
		page.imgBtns.push(btn);
		page.appendChild(btn);
	}

	this.pageContainer.appendChild(page);
	this.atlasPages.push(page);

};


G.ModifyDOMFrameSelector.prototype.makeImageBtn = function(imgName){

	var frameSelector = this;

	var img = document.createElement('img');
	img.src = G.Utils.getImageURI(imgName);
	img.style.width = '50px';
	img.style.height = '50px';
	img.imgName = imgName;
	img.onclick = function(){
		frameSelector.onFrameClicked.dispatch(this.imgName);
	}	

	return img;

};
G.ModifyDOMLayer = function(modify){

	this.modify = modify;

	this.openElement = null;

	this.extraDataDiv = this.initExtraDataDiv();
	this.inputDataDiv = this.initInputDiv();

};

G.ModifyDOMLayer.prototype.closeCurrent = function(){

	game.time.events.add(1,function(){
		game.input.enabled = true;
	});
	this.openElement.style.display = 'none';
	game.canvas.focus();

};

G.ModifyDOMLayer.prototype.initExtraDataDiv = function(){

	var dataInputDiv = document.createElement('DIV');
	dataInputDiv.style.backgroundColor = 'green';
	dataInputDiv.style.left = '10%';
	dataInputDiv.style.top = '10%';
	dataInputDiv.style.position = 'fixed';
	dataInputDiv.style.width = '80%';
	dataInputDiv.style.height = '80%';

	var input = document.createElement('TEXTAREA');
	input.style.marginTop = '2%';
	input.style.marginLeft = '2%';
	input.style.width = '95%';
	input.style.height = '94%';
	input.style.resize = 'none';

	input.onkeydown = (function(e){

		var textarea = e.target;
		var div = dataInputDiv;

		//check if data is correct
	    game.time.events.add(1, function(){
	    	try {
				eval('var tmp = '+textarea.value);
				if (typeof tmp === 'object'){
					div.style.backgroundColor = 'green';
					div.proper = true;
				}else {
					div.style.backgroundColor = 'red';
					div.proper = false;
				}
			}catch(e){
				div.style.backgroundColor = 'red';
				div.proper = false;
			}
	    });


	    if(e.keyCode==9 || e.which==9){
	        e.preventDefault();
	        var s = textarea.selectionStart;
	        textarea.value = textarea.value.substring(0,textarea.selectionStart) + "\t" + textarea.value.substring(textarea.selectionEnd);
	        textarea.selectionEnd = s+1; 
	    }

	    if(e.keyCode == 83 && e.ctrlKey) {
	    	e.preventDefault();
	    	if (div.proper){
	    		this.closeCurrent();
	    		div.callback.call(div.context,textarea.value);
	    	}
	    	return false;

	    }

	    if (e.keyCode == 27) {
			this.closeCurrent();
	    } 

	}).bind(this);

	dataInputDiv.textarea = input;

	dataInputDiv.appendChild(input);
	document.body.appendChild(dataInputDiv);
	
	dataInputDiv.style.display = 'none';
	dataInputDiv.style.position = 'fixed';


	return dataInputDiv;

};

G.ModifyDOMLayer.prototype.openExtraData = function(label,data,callback,context){

	console.log('openExtraData');

	this.openElement = this.extraDataDiv;

	this.extraDataDiv.style.backgroundColor = 'green';
	this.extraDataDiv.callback = callback || function(){};
	this.extraDataDiv.context = context || this;

	this.extraDataDiv.style.display = 'block';
	game.input.enabled = false;

	if (data) {
		if (typeof data === 'object'){
			data = JSON.stringify(data,null,"\t");
		}
	}else {
		data = '';
	}

	this.extraDataDiv.textarea.value = data;

	game.time.events.add(1,function(){
		this.extraDataDiv.textarea.focus();
	},this);

};


G.ModifyDOMLayer.prototype.initInputDiv = function(){

	var inputDiv = document.createElement('DIV');
	inputDiv.style.backgroundColor = 'gray';
	inputDiv.style.left = '30%';
	inputDiv.style.top = '10%';
	inputDiv.style.position = 'fixed';
	inputDiv.style.width = '40%';
	inputDiv.style.textAlign = 'center';
	inputDiv.style.padding = '10px';
	inputDiv.style.fontFamily = 'Verdana';

	var span = document.createElement('h3');

	var filterLabel = document.createElement('SPAN');
	filterLabel.style.float = 'right';

	var initValue = document.createElement('SPAN');
	initValue.style.float = 'left';

	span.innerHTML = '';

	var input = document.createElement('INPUT');
	input.style.width = '90%';
	input.style.fontSize = '25px';

	input.onkeydown = (function(e){

		var textarea = e.target;
		var div = inputDiv;

	    if((e.keyCode == 83 && e.ctrlKey) || (e.keyCode == 13)) {
	    	e.preventDefault();

	    	var filteredValue = div.filter(textarea.value);

	    	if (filteredValue === undefined){

	    		div.style.backgroundColor = 'red';
	    		game.time.events.add(50,function(){
	    			div.style.backgroundColor = 'gray';
	    		});


	    	}else{

	    		this.closeCurrent();
    			div.callback.call(div.context,filteredValue);

	    	}
	    	return false;
	    }

	    if (e.keyCode == 27) {
			this.closeCurrent();
	    } 

	}).bind(this);

	inputDiv.appendChild(span);
	inputDiv.appendChild(input);
	inputDiv.appendChild(filterLabel);
	inputDiv.appendChild(initValue);
	document.body.appendChild(inputDiv);

	inputDiv.span = span;
	inputDiv.textarea = input;
	inputDiv.input = input;
	inputDiv.filterLabel = filterLabel;
	inputDiv.initValue = initValue;

	inputDiv.filters = {
		number: function(value){
			var parsed = parseFloat(value);
			if (isNaN(parsed)){
				return undefined;
			}else{
				return parsed;
			}
		},
		string: function(value){

			if (value.length == 0) return undefined;

			return value;
		},
		none: function(value){
			return value;
		}
	}

	inputDiv.style.display = 'none';
	inputDiv.style.position = 'fixed';

	return inputDiv;

};

G.ModifyDOMLayer.prototype.openInputDiv = function(label,initValue,callback,context,filter){

	if (!this.inputDataDiv){
		this.initInputArea();
	}

	this.openElement = this.inputDataDiv;

	this.inputDataDiv.style.display = 'block';
	game.input.enabled = false;

	this.inputDataDiv.span.innerHTML = label || '';

	this.inputDataDiv.input.value = initValue;

	this.inputDataDiv.callback = callback || function(){};
	this.inputDataDiv.context = context || this;

	filter = filter || 'none';
	this.inputDataDiv.filter = this.inputDataDiv.filters[filter];
	this.inputDataDiv.filterLabel.innerHTML = filter;

	this.inputDataDiv.initValue.innerHTML = 'init val: '+initValue;

	game.time.events.add(1,function(){
		this.inputDataDiv.input.focus();
		this.inputDataDiv.input.select();
	},this);

};


G.ModifyDOMPropButton = function(modify,label,refreshFunc,setFunc,postSet){

	this.modify = modify;

	this.domElement = document.createElement('li');
	this.domButton = document.createElement('button');
	this.domLabel = document.createElement('span');
	this.domLabel.innerHTML = label+': ';
	this.domButton.appendChild(this.domLabel);
	this.domValue = document.createElement('span');
	this.domButton.appendChild(this.domValue);
	this.domElement.appendChild(this.domButton);

	if (typeof refreshFunc === 'string') {
		this.refreshProp = refreshFunc.split('.');
	}else {
		this.refreshFunc = refreshFunc;
	}

	if (typeof setFunc === 'string'){
		this.filterProperty = setFunc.slice(0,setFunc.indexOf(':'));
		this.setProp =	setFunc.slice(setFunc.indexOf(':')+1).split('.');
		this.setFunc = this.openInput;
	}else{
		this.setFunc = setFunc;
	}

	this.postSet = postSet;

	this.domButton.onclick = this.setFunc.bind(this);

};

G.ModifyDOMPropButton.prototype.setFunc = function(){

	var obj = this.modify.getCurrentObject();

	if (!obj) return;

	var value = this[this.askFunc]();

	if (value === null) return;

	this.modify.modifyCurrentObjProp(this.refreshProp,value);

	if (this.postSet){
		this.postSet(obj,value);
	}

};


G.ModifyDOMPropButton.prototype.openInput = function(){

	var obj = this.modify.getCurrentObject();

	if (!obj) return;

	this.modify.domLayer.openInputDiv(
		this.modify.getChildLabel(obj)+' | '+this.setProp,
		G.Utils.getObjProp(obj,this.setProp),
		function(value){
			this.modify.modifyCurrentObjProp(this.refreshProp,value);
			if (this.postSet){
				this.postSet(obj,value);
			}
		},
		this,
		this.filterProperty);

};

G.ModifyDOMPropButton.prototype.refreshFunc = function(obj){

	this.domValue.innerHTML = '---';

	var obj = this.modify.getCurrentObject();

	if (!obj) {
		this.domElement.style.display = 'none';
		return;
	}

	var currentObj = obj;

	var val = G.Utils.getObjProp(obj,this.refreshProp);

	if (val === undefined){
		this.domElement.style.display = 'none';
	}else{
		this.domElement.style.display = 'list-item';
		if (typeof val === 'number'){
			val = val.toFixed(2);
		}

		this.domValue.innerHTML = val;
	}

};
G.ModifyDOMPropList = function(modify){

	G.Utils.injectCSS(this.cssClasses.join('\n'));

	this.modify = modify;

	this.buttons = [];

	this.mainDiv = document.createElement('div');
	this.mainDiv.className = 'modifyPLmainDiv';
	this.list = document.createElement('ul');
	this.list.className = 'modifyPLul';
	this.mainDiv.appendChild(this.list);

	this.addButton('x','x','number:x');
	this.addButton('y','y','number:y');
	this.addButton('width','width','number:width');
	this.addButton('height','height','number:height');
	this.addButton('scale.x','scale.x','number:scale.x');
	this.addButton('scale.y','scale.y','number:scale.y');
	this.addButton('angle','angle','number:angle');
	this.addButton('alpha','alpha','number:alpha');
	this.addButton('visible','visible',function(){
		var obj = modify.currentObject;
		modify.modifyCurrentObjProp('visible',!obj.visible);
	});
	this.addButton('anchor.x','anchor.x','number:anchor.x');
	this.addButton('anchor.y','anchor.y','number:anchor.y');
	this.addButton('frame','frameName',function(){
		modify.frameSelector.open();
	});
	this.addButton('fontSize','fontSize','number:fontSize',function(obj,value){

		if (obj.cacheAsBitmap){
			obj.orgFontSize = value;
			if (obj.setText) obj.setText(obj.text);
		}

		//in case of labelgroup
		if (obj.refresh) obj.refresh();
	});
	this.addButton('font','font',function(){

		var obj = modify.getCurrentObject();

		var keys = Object.keys(game.cache._cache.bitmapFont);
		var fontIndex = keys.indexOf(obj.font);
		modify.modifyCurrentObjProp('font',keys[(fontIndex+1)%keys.length]);
		if (obj.cacheAsBitmap){
			if (obj.setText) obj.setText(obj.text);
		}

		//in case of labelgroup
		if (obj.refresh) obj.refresh();
	});
	this.addButton('text','text','string:text',function(obj){
		if (obj.cacheAsBitmap){
			if (obj.setText) obj.setText(obj.text);
		}
	});
	this.addButton('maxUserWidth','maxUserWidth','number:maxUserWidth',function(obj,value){
		if (obj.cacheAsBitmap){
			obj.setText(obj.text);
		}
	});
	this.addButton('maxUserHeight','maxUserHeight','number:maxUserHeight',function(obj,value){
		if (obj.cacheAsBitmap){
			obj.setText(obj.text);
		}
	});
	this.addButton('fixedToCamera','fixedToCamera',function(){
		var obj = modify.getCurrentObject();
		modify.modifyCurrentObjProp('fixedToCamera',!obj.fixedToCamera);
	});

	this.addButton('cameraOffset.x','cameraOffset.x','number:cameraOffset.x');
	this.addButton('cameraOffset.y','cameraOffset.y','number:cameraOffset.y');
	this.addButton('EXTRA_DATA',function(){

			var obj = this.modify.getCurrentObject();

			this.domElement.style.display = 'list-item';

			if (!obj) {
				this.domElement.style.display = 'none';
				return;
			}

			if (obj && obj.___DATA) {
				this.domValue.innerHTML = 'YES'
			}else {
				this.domValue.innerHTML = '---'
			}	

	},function(){

		var obj = this.modify.getCurrentObject();

		this.modify.domLayer.openExtraData(obj.label, obj.___DATA || {},function(newData){

			//means empty string
			if (!newData) {
				delete obj.___DATA;
			}else {

				try {
					eval('var tmp = '+newData);

					if (typeof tmp === 'object'){

						obj.___DATA = tmp;
						this.refreshFunc();

						//obj.___DATAPARSED = tmp;
					}else {
						console.warn('extra data cannot be a string');
					}

				}catch(e){
					console.warn('something went wrong with parsing value');
				}

			}

		});

	});

	this.modify.onLevelObjChange.add(this.refreshValues,this);
	this.modify.onCurrentObjChange.add(this.refreshValues,this);
	this.modify.onCurrentObjPropModified.add(this.refreshValues,this);

};

G.ModifyDOMPropList.prototype.addButton = function(label,refreshFunc,setFunc,postSet){
	
	var button = new G.ModifyDOMPropButton(this.modify,label,refreshFunc,setFunc,postSet);
	this.buttons.push(button);
	button.domButton.className = 'modifyPLButton';

	this.list.appendChild(button.domElement);
};

G.ModifyDOMPropList.prototype.refreshValues = function(){

	this.buttons.forEach(function(button){
		button.refreshFunc();
	});

};

G.ModifyDOMPropList.prototype.cssClasses = [
'.modifyPLmainDiv {font-family: verdana; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none;}',
'.modifyPLButton {pointer-events: all; margin: 0; border: 0; background-color: rgba(100,200,200,0.5); font-weight: bold; font-size: 0.7em;}',
".modifyPLul {margin: 0; margin-top: 10px; padding: 0; line-style: none;}" 
]
G.ModifyAnimationEditor = function(modify){

	Phaser.Group.call(this,game);

	this.modify = G.Modify.instance;

	this.tl = new G.ModifyAnimationTL();
	this.tl.x = 100;
	this.add(this.tl);
	
	this.fw = new G.ModifyAnimationFrameWindow();
	this.fw.x = -250;
	this.add(this.fw);

	this.tl.onFrameSelected.add(this.fw.refresh,this.fw);

	this.fw.onChange.add(function(obj,frameNr){
		console.log('fw onchange');
		this.tl.redrawTl();
		obj.updateAnimation(frameNr);
	},this);
	this.tl.changeTlPxWidth(800);

	this.visible = false;

	this.modify.onLevelObjChange.add(function(){

		var obj = this.modify.getCurrentLevelObject();

		if (obj.ANIMATIONELEMENT){
			this.open(obj);
		}else{
			this.close();
		}

	},this);

};

G.ModifyAnimationEditor.prototype = Object.create(Phaser.Group.prototype);

G.ModifyAnimationEditor.prototype.open = function(o){
	this.visible = true;
	this.tl.open(o);
	this.fw.refresh(o,0);

};

G.ModifyAnimationEditor.prototype.close = function(){

	this.visible = false;

}
G.ModifyAnimationFrameGroup = function(x,y){

	Phaser.Group.call(this,game);

	this.x = x;
	this.y = y;

	this.active = false;

	this.currentObj = null;
	this.currentKeyFrame = null;
	this.currentFrameNr = 0;

	this.style = {
		font: 'Verdana',
		fontSize: 13,
		fontWeight: 'bold'
	};

	this.onOffBtn = game.add.text(0,0,'off',this.style);
	this.onOffBtn.inputEnabled = true;
	this.onOffBtn.hitArea = new Phaser.Rectangle(0,0,this.onOffBtn.width,this.onOffBtn.height);
	this.onOffBtn.events.onInputDown.add(this.onOff,this);

	this.propValue = game.add.text(280,0,'---',this.style);
	this.propValue.anchor.x = 1;

	this.addMultiple([this.onOffBtn,this.propValue]);

	this.onChange = new Phaser.Signal();

};

G.ModifyAnimationFrameGroup.prototype = Object.create(Phaser.Group.prototype);

G.ModifyAnimationFrameGroup.prototype.onOff = function(){
		
		if (this.currentFrameNr == 0) return;

		if (this.active){

			this.active = false;
			this.alpha = 0.5;
			this.onOffBtn.setText('off');

			var index = this.currentObj.frameTL.indexOf(this.currentKeyFrame);
			this.currentObj.frameTL.splice(index,1);	

		}else{

			this.active = true;
			this.alpha = 1;
			this.onOffBtn.setText('on');

			var newKeyFrame = {
				f: this.currentFrameNr,
				v: G.Utils.getObjProp(this.currentObj.SPR,'frameName')
			};

			var f = this.currentFrameNr;
			var timeline = this.currentObj.frameTL;

			var indexToPut = 0;
			for (var i = 0; i < timeline.length; i++){
				if (timeline[i].f < f){
					indexToPut++;
				}
			}


			timeline.splice(indexToPut,0,newKeyFrame);

		}

		this.refresh(this.currentObj,this.currentFrameNr);
		//this.onChange.dispatch(this.currentObj,this.frameNr);

};

G.ModifyAnimationFrameGroup.prototype.update = function(){

	if (this.currentObj.playing){
		this.refresh(this.currentObj,this.currentObj.frameCounter);
		return;
	}


	if (this.currentObj){
		var val = G.Utils.getObjProp(this.currentObj.SPR,'frameName') || G.Utils.getObjProp(this.currentObj.SPR,'key');

		if (val.indexOf('/')){
			val = val.slice(val.lastIndexOf('/')+1);
			//*val = val.slice(val.lastIndexOf('.'));
		}

		//show unsaved changes
		if (this.currentKeyFrame == null){
			if ( val != this.valAtRefresh){
				this.propValue.fill = 'red';
				this.alpha = 1;
			}else{
				this.alpha = 0.5;
				this.propValue.fill = 'black';
			}	
		}

		if (!this.currentObj.playing 
			&& this.currentKeyFrame && this.currentKeyFrame.v !== val){
			this.currentKeyFrame.v = val;
		}

		this.propValue.setText(val);

	}else{
		this.propValue.setText('---');
	}

};



G.ModifyAnimationFrameGroup.prototype.refresh = function(obj,frameNr){

	this.currentObj = obj;

	if (!this.currentObj.currentAnimationName) return;


	this.currentKeyFrame = obj.getKeyFrameAt(obj.frameTL,frameNr);
	this.currentFrameNr = frameNr;

	this.propValue.fill = 'black';
	
	this.valAtRefresh = G.Utils.getObjProp(this.currentObj.SPR,'frameName');

	if (this.currentKeyFrame){
		this.active = true;
		this.alpha = 1;

		this.onOffBtn.setText('on');

		console.log('frameGroup refresh');
		console.log(this.currentObj.getTextureFrameValue(obj.frameTL,frameNr));

		this.propValue.setText(this.currentObj.getTextureFrameValue(obj.frameTL,frameNr) || '---');

	}else {
		this.onOffBtn.setText('off');
		this.active = false;
		this.alpha = 0.5;
		this.propValue.setText('---');
	}

};
G.ModifyAnimationFrameWindow = function(){

	Phaser.Group.call(this,game);

	this.onChange = new Phaser.Signal();

	this.gfx =  game.add.graphics();
	this.gfx.inputEnabled = true;
	this.add(this.gfx);

	this.gfx.beginFill(0xdddddd);
	this.gfx.drawRect(0,0,300,500);

	this.style = {
		font: 'Verdana',
		fontSize: 13,
		fontWeight: 'bold'
	};

	this.currentAnimationTxt = game.add.text(10,10,'',this.style);
	this.add(this.currentAnimationTxt);
	this.currentAnimationTxt.inputEnabled = true;
	this.currentAnimationTxt.events.onInputDown.add(function(){
		this.changeAnimation();
	},this);

	this.addAnimationBtn = game.add.text(170,10,'+',this.style);
	this.add(this.addAnimationBtn);
	this.addAnimationBtn.inputEnabled = true;
	this.addAnimationBtn.events.onInputDown.add(this.addNewAnimation,this);

	this.renameAnimationBtn = game.add.text(200,10,'R',this.style);
	this.add(this.renameAnimationBtn);
	this.renameAnimationBtn.inputEnabled = true;
	this.renameAnimationBtn.events.onInputDown.add(this.renameAnimation,this);

	this.removeAnimationBtn = game.add.text(230,10,'-',this.style);
	this.add(this.removeAnimationBtn);
	this.removeAnimationBtn.inputEnabled = true;
	this.removeAnimationBtn.events.onInputDown.add(this.removeAnimation,this);

	this.frameNr = game.add.text(290,10,'',this.style);
	this.frameNr.anchor.x = 1;
	this.add(this.frameNr);

	this.frameGroup = new G.ModifyAnimationFrameGroup(10,50);
	this.add(this.frameGroup);

	this.propGroups = [
		new G.ModifyAnimationPropGroup(10,70,'alpha','#43c9e7'),
		new G.ModifyAnimationPropGroup(10,90,'x','#e08040'),
		new G.ModifyAnimationPropGroup(10,110,'y','#d8ff30'),
		new G.ModifyAnimationPropGroup(10,130,'angle','#072ba0'),
		new G.ModifyAnimationPropGroup(10,150,'scale.x','#6c0674'),
		new G.ModifyAnimationPropGroup(10,170,'scale.y','#d34ed9'),
		new G.ModifyAnimationPropGroup(10,190,'anchor.x'),
		new G.ModifyAnimationPropGroup(10,210,'anchor.y')
	]

	this.propGroups.forEach(function(pg){
		pg.onChange.add(this.onChange.dispatch,this.onChange);
	},this);

	this.addMultiple(this.propGroups);

};

G.ModifyAnimationFrameWindow.prototype = Object.create(Phaser.Group.prototype);

G.ModifyAnimationFrameWindow.prototype.update = function(){

	if (!this.currentObj) return;

	this.propGroups.forEach(function(g){
		g.update();
	},this);

	this.frameGroup.update();

};

G.ModifyAnimationFrameWindow.prototype.loadFrame = function(obj,frameNr){

	this.currentObj = obj;
	this.labelObjTxt.setText(obj.LABEL || 'obj');
	this.frameNr.setText(frameNr);

};

G.ModifyAnimationFrameWindow.prototype.refresh = function(obj,frameNr){

	this.propGroups.forEach(function(pg){
		pg.refresh(obj,frameNr);
	});

	this.frameGroup.refresh(obj,frameNr);

	this.frameNr.setText(frameNr);

	this.currentFrameNr = frameNr;
	this.currentObj = obj;

	this.currentAnimationTxt.setText(this.currentObj.currentAnimationName || '------');

};

G.ModifyAnimationFrameWindow.prototype.changeAnimation = function(name){

	if (!this.currentObj) return;

	var animations = Object.keys(this.currentObj.dataAnimation);
	console.log(JSON.stringify(animations));

	if (name){

		this.currentObj.changeAnimationData(name);

	}else{

		if (this.currentObj.currentAnimationName){
			var index = animations.indexOf(this.currentObj.currentAnimationName);
			var newIndex = (index+1)%animations.length;
			console.log(index,newIndex);
			this.currentObj.changeAnimationData(animations[newIndex]);
		}else{
			this.currentObj.changeAnimationData(animations[0]);
		}

	}

	this.refresh(this.currentObj,this.currentFrameNr);
	this.onChange.dispatch(this.currentObj,0);

};

G.ModifyAnimationFrameWindow.prototype.addNewAnimation = function(){

	if (!this.currentObj) return;

	var animations = Object.keys(this.currentObj.dataAnimation);

	var name = 'newAnimation';
	var number = 0;

	while(animations.indexOf(name+number) !== -1){
		number++;
	}

	this.currentObj.dataAnimation[name+number] = {
		eventTL: [],
		frameTL: [{f:0, v:null}],
		propTLS: {
			alpha: [{f:0,v:1}],
			x: [{f:0,v:0}],
			y: [{f:0,v:0}],
			angle: [{f:0,v:0}],
			'scale.x': [{f:0,v:1}],
			'scale.y': [{f:0,v:1}],
			'anchor.x':  [{f:0,v:0.5}],
			'anchor.y':  [{f:0,v:0.5}]
		}
	}

	this.changeAnimation(name+number);

};

G.ModifyAnimationFrameWindow.prototype.removeAnimation = function(){

	if (!this.currentObj) return;
	if (!this.currentObj.currentAnimationName) return;

	if (Object.keys(this.currentObj.dataAnimation).length == 1) return;

	if (confirm('delete '+this.currentObj.currentAnimationName+'?')){
		delete this.currentObj.dataAnimation[this.currentObj.currentAnimationName];
		this.changeAnimation();
	}

};

G.ModifyAnimationFrameWindow.prototype.renameAnimation = function(){

	if (!this.currentObj) return;
	if (!this.currentObj.currentAnimationName) return;

	G.Modify.instance.domLayer.openInputDiv(
		this.currentObj.currentAnimationName,
		this.currentObj.currentAnimationName,
		function(value){
			var oldName = this.currentObj.currentAnimationName;
			var dataAnimation = this.currentObj.currentAnimationData;

			delete this.currentObj.dataAnimation[oldName];

			this.currentObj.dataAnimation[value] = dataAnimation;
			this.changeAnimation(value);

		},
		this,
		'string'
	);

};
G.ModifyAnimationPropGroup = function(x,y,prop,color){

	Phaser.Group.call(this,game);

	this.x = x;
	this.y = y;

	this.propKey = prop;
	this.active = false;

	this.currentObj = null;
	this.currentKeyFrame = null;
	this.currentFrameNr = 0;

	this.style = {
		font: 'Verdana',
		fontSize: 13,
		fontWeight: 'bold'
	};

	this.easings = [
		'Back','Bounce','Circular','Cubic','Elastic','Exponential','Linear','Quadratic','Quartic','Quintic','Sinusoidal'
	];


	this.onOffBtn = game.add.text(0,0,'off',this.style);
	this.onOffBtn.inputEnabled = true;
	this.onOffBtn.hitArea = new Phaser.Rectangle(0,0,this.onOffBtn.width,this.onOffBtn.height);
	this.onOffBtn.events.onInputDown.add(this.onOff,this);

	this.label = game.add.text(30,0,prop,this.style);
	if (color) this.label.addColor(color,0);

	this.easingLabel0 = game.add.text(120,0,'',this.style);
	this.easingLabel0.inputEnabled = true;
	this.easingLabel0.hitArea = new Phaser.Rectangle(0,0,80,this.easingLabel0.height);
	this.easingLabel0.events.onInputDown.add(this.changeEasing0,this);

	this.easingLabel1 = game.add.text(200,0,'',this.style);
	this.easingLabel1.inputEnabled = true;
	this.easingLabel1.hitArea = new Phaser.Rectangle(0,0,50,this.easingLabel1.height);
	this.easingLabel1.events.onInputDown.add(this.changeEasing1,this);

	this.propValue = game.add.text(280,0,'',this.style);
	this.propValue.anchor.x = 1;

	this.addMultiple([this.label,this.onOffBtn,this.easingLabel0,this.easingLabel1,this.propValue]);

	this.onChange = new Phaser.Signal();

};

G.ModifyAnimationPropGroup.prototype = Object.create(Phaser.Group.prototype);

G.ModifyAnimationPropGroup.prototype.onOff = function(){
		
		if (this.currentFrameNr == 0) return;

		if (this.active){

			this.active = false;
			this.alpha = 0.5;
			this.onOffBtn.setText('off');

			var index = this.currentObj.propTLS[this.propKey].indexOf(this.currentKeyFrame);
			this.currentObj.propTLS[this.propKey].splice(index,1);	

		}else{

			this.active = true;
			this.alpha = 1;
			this.onOffBtn.setText('on');

			var newKeyFrame = {
				f: this.currentFrameNr,
				v: G.Utils.getObjProp(this.currentObj.SPR,this.propKey)
			};

			var f = this.currentFrameNr;
			var timeline = this.currentObj.propTLS[this.propKey];

			var indexToPut = 0;
			for (var i = 0; i < timeline.length; i++){
				if (timeline[i].f < f){
					indexToPut++;
				}
			}
			
			timeline.splice(indexToPut,0,newKeyFrame);

		}

		this.refresh(this.currentObj,this.currentFrameNr);
		//this.onChange.dispatch(this.currentObj,this.frameNr);

};

G.ModifyAnimationPropGroup.prototype.update = function(){

	if (this.currentObj.playing){
		this.refresh(this.currentObj,this.currentObj.frameCounter);
		return;
	}


	if (this.currentObj){
		var val = G.Utils.getObjProp(this.currentObj.SPR,this.propKey);

		//show unsaved changes
		if (this.currentKeyFrame == null){
			if ( val != this.valAtRefresh){
				this.propValue.fill = 'red';
				this.alpha = 1;
			}else{
				this.alpha = 0.5;
				this.propValue.fill = 'black';
			}	
		}

		if (!this.currentObj.playing 
			//&& this.currentObj.frameCounter == this.currentFrameNr 
			&& this.currentKeyFrame && this.currentKeyFrame.v !== val){
			this.currentKeyFrame.v = val;
		}

		this.propValue.setText(val.toFixed(1));

	}else{
		this.propValue.setText('---');
	}

};

G.ModifyAnimationPropGroup.prototype.changeEasing0 = function(){
	
	if (!this.currentKeyFrame) return;

	if (this.currentKeyFrame.e){
		var index = this.easings.indexOf(this.currentKeyFrame.e[0]);

		if (index+1 == this.easings.length){
			this.currentKeyFrame.e = false;
			this.easingLabel0.setText('--');
			this.easingLabel1.setText('--');
		}else{
			this.currentKeyFrame.e[0] = this.easings[index+1];
			this.easingLabel0.setText(this.easings[index+1]);

			var currentE1 = this.currentKeyFrame.e[1];

			if (!Phaser.Easing[this.easings[index+1]][currentE1]){
				if (Phaser.Easing[this.easings[index+1]]['None']){
					this.currentKeyFrame.e[1] = 'None';
				}else if (Phaser.Easing[this.easings[index+1]]['In']){
					this.currentKeyFrame.e[1] = 'In';
				}
			}

			this.easingLabel1.setText(this.currentKeyFrame.e[1]);

		}

	}else {

		this.currentKeyFrame.e = ['Back','In'];
		this.easingLabel0.setText('Back');
		this.easingLabel1.setText('In');

	}

	this.onChange.dispatch(this.currentObj,this.currentFrameNr);

};

G.ModifyAnimationPropGroup.prototype.changeEasing1 = function(){

	if (!this.currentKeyFrame) return;
	if (!this.currentKeyFrame.e) return;

	var currentE1 = this.currentKeyFrame.e[1];
	var keys = Object.keys(Phaser.Easing[this.currentKeyFrame.e[0]]);

	var index = keys.indexOf(currentE1);

	this.currentKeyFrame.e[1] = keys[(index+1)%keys.length];
	this.easingLabel1.setText(this.currentKeyFrame.e[1]);

	this.onChange.dispatch(this.currentObj,this.currentFrameNr);

};



G.ModifyAnimationPropGroup.prototype.refresh = function(obj,frameNr){

	this.currentObj = obj;

	if (!this.currentObj.currentAnimationName) return;


	this.currentKeyFrame = obj.getKeyFrameAt(obj.propTLS[this.propKey],frameNr);
	this.currentFrameNr = frameNr;

	this.propValue.fill = 'black';

	this.valAtRefresh = G.Utils.getObjProp(this.currentObj.SPR,this.propKey);

	if (this.currentKeyFrame){
		this.active = true;
		this.alpha = 1;

		this.onOffBtn.setText('on');

		if (this.currentKeyFrame.e){
			this.easingLabel0.setText(this.currentKeyFrame.e[0]);
			this.easingLabel1.setText(this.currentKeyFrame.e[1]);
		}else{
			this.easingLabel0.setText('---');
			this.easingLabel1.setText('---');
		}

	}else {
		this.onOffBtn.setText('off');
		this.active = false;
		this.alpha = 0.5;
		this.easingLabel0.setText('---');
		this.easingLabel1.setText('---');
	}

};
G.ModifyAnimationTL = function(){

	Phaser.Group.call(this,game);

	this.gfx = game.add.graphics();
	this.add(this.gfx);

	this.tlGfx = game.add.graphics();
	this.tlGfx.inputEnabled = true;

	this.pointerPressed = false;
	this.pointerStartFrame = 0;
	this.tlGfx.events.onInputDown.add(this.onDown,this);
	this.tlGfx.events.onInputUp.add(this.onUp,this);

	this.add(this.tlGfx);

	this.visible = false;
	this.currentObj = null;

	this.frameWidth = 10;
	this.frameHeight = 50;
	this.tlPxWidth = 400;
	this.tlFrameLength = this.tlPxWidth/this.frameWidth;

	this.selectedFrame = null;


	this.frameOffset = 0;

	this.cursors = game.input.keyboard.createCursorKeys();

	this.cursors.left.onDown.add(function(){
		this.frameOffset--;
		this.redrawTl();
	},this);

	this.cursors.right.onDown.add(function(){
		this.frameOffset++;
		this.redrawTl();
	},this);

	this.onFrameSelected = new Phaser.Signal();


};

G.ModifyAnimationTL.prototype = Object.create(Phaser.Group.prototype);

G.ModifyAnimationTL.prototype.colors = [0x972234,0x008b50,0x43c9e7,0xe08040,0xd8ff30,0x072ba0,0x6c0674,0xd34ed9];

G.ModifyAnimationTL.prototype.update = function(){

	if (this.pointerPressed){
		var p = game.input.activePointer;
		var frameNr = Math.floor((p.x - this.tlGfx.worldPosition.x)/this.frameWidth);
		if (frameNr !== this.pointerStartFrame){
			var diff = this.pointerStartFrame-frameNr;
			this.frameOffset += diff;
			this.pointerStartFrame = frameNr;
			this.frameOffset = Math.max(0,this.frameOffset);
			this.redrawTl();

		}
	}


};


G.ModifyAnimationTL.prototype.changeFrameWidth = function(newWidth){
	this.frameWidth = newWidth;
	this.tlFrameLength = Math.floor(this.tlPxWidth/this.frameWidth);
	this.redrawTl();
};

G.ModifyAnimationTL.prototype.changeTlPxWidth = function(newWidth){
	this.tlPxWidth = newWidth;
	this.tlFrameLength = Math.floor(this.tlPxWidth/this.frameWidth);
	this.redrawTl();
};

G.ModifyAnimationTL.prototype.open = function(obj){

	this.currentObj = obj;
	this.visible = true;
	this.redrawTl();
	this.currentObj.stop();

};

G.ModifyAnimationTL.prototype.onDown = function(obj,p){

	this.currentObj.pause();
	var frameNr = Math.floor((p.x - this.tlGfx.worldPosition.x)/this.frameWidth);
	this.pointerStartFrame = frameNr;
	this.pointerPressed = true;
};

G.ModifyAnimationTL.prototype.onUp = function(obj,p){

	var frameNr = Math.floor((p.x - this.tlGfx.worldPosition.x)/this.frameWidth);
	if (this.pointerStartFrame == frameNr){
		this.selectFrame(frameNr);
		this.pointerStar
	}
	this.pointerPressed = false;

};

G.ModifyAnimationTL.prototype.selectFrame = function(frameNr){

	this.selectedFrame = frameNr+this.frameOffset;
	this.currentObj.updateAnimation(this.selectedFrame);
	this.redrawTl();
	this.onFrameSelected.dispatch(this.currentObj,this.selectedFrame);

};

G.ModifyAnimationTL.prototype.redrawTl = function(){
	
	this.tlGfx.clear();

	if (!this.currentObj) return;
	if (!this.currentObj.currentAnimationName) return;

	this.tlGfx.beginFill(0xdddddd,1);
	this.tlGfx.drawRect(0,0,this.tlFrameLength*this.frameWidth,this.frameHeight);

	this.tlGfx.beginFill(0x999999,1);



	for (var i = this.frameOffset; i < this.frameOffset+this.tlFrameLength; i++){

		if (this.currentObj.isAnyKeyFrameAt(i)){
			this.tlGfx.lineStyle(1,0x000000,1);
			this.tlGfx.drawRect(this.frameWidth*i-(this.frameOffset*this.frameWidth),0,this.frameWidth,this.frameHeight);
		}

		if (i % 60 == 0){
			this.tlGfx.lineStyle(1,0x000000,0.25);
			this.tlGfx.moveTo(this.frameWidth*i-(this.frameOffset*this.frameWidth),0);
			this.tlGfx.lineTo(this.frameWidth*i-(this.frameOffset*this.frameWidth),this.frameHeight);
		}
	}



	this.tlGfx.lineStyle(0,0x000000,0);
	//event tl
	for (var i = 0; i < this.currentObj.eventTL.length; i++){
		var key = this.currentObj.eventTL[i];
		this.tlGfx.beginFill(this.colors[0],1);
		if (key.f >= this.frameOffset && key.f < this.frameOffset+this.tlFrameLength){
			this.tlGfx.drawRect(this.frameWidth*key.f-(this.frameOffset*this.frameWidth),0,this.frameWidth,5);
		}
	};

	for (var i = 0; i < this.currentObj.frameTL.length; i++){
		var key = this.currentObj.frameTL[i];
		this.tlGfx.beginFill(this.colors[1],1);
		if (key.f >= this.frameOffset && key.f < this.frameOffset+this.tlFrameLength){
			this.tlGfx.drawRect(this.frameWidth*key.f-(this.frameOffset*this.frameWidth),5,this.frameWidth,5);
		}
	}

	for (var i = 0; i < this.currentObj.propKeys.length; i++){
		this.drawPropLine(this.currentObj.propTLS[this.currentObj.propKeys[i]],15+i*5,this.colors[2+i]);
	}

	if (this.selectedFrame !== null && this.selectedFrame >= this.frameOffset && this.selectedFrame < this.frameOffset+this.tlFrameLength){
		this.tlGfx.beginFill(0x0000ff,0.5);
		this.tlGfx.drawRect(this.frameWidth*this.selectedFrame-(this.frameOffset*this.frameWidth),0,this.frameWidth,this.frameHeight);
	}

};

G.ModifyAnimationTL.prototype.drawPropLine = function(tl, y, color){

	var x;
	var w = this.frameWidth*0.5;

	for (var i = 0; i < tl.length; i++){
		var kf = tl[i];


		x = (kf.f*this.frameWidth+(this.frameWidth*0.5))-(this.frameOffset*this.frameWidth);
		
		this.tlGfx.lineStyle(0,0,0);

		if (kf.f < this.frameOffset) continue;
		

		//check if there was easing in prev key

		var pkf = tl[i-1];
		if (pkf && pkf.e){
			this.tlGfx.lineStyle(2,color,1);
			this.tlGfx.moveTo(0,y);
			this.tlGfx.lineTo(
				Math.min(
					this.tlFrameLength*this.frameWidth,
					kf.f*this.frameWidth-(this.frameOffset*this.frameWidth)
				),y);
		};

		if (kf.f >= this.frameOffset+this.tlFrameLength) continue;

		if (kf.e){
			this.tlGfx.beginFill(color,1);
			this.tlGfx.drawCircle(x,y,w);

			if (tl[i+1]){
				this.tlGfx.lineStyle(2,color,1);
				this.tlGfx.moveTo(x,y);
				var lineToX = tl[i+1].f*this.frameWidth-(this.frameOffset*this.frameWidth);
				lineToX = Math.min(this.tlFrameLength*this.frameWidth,lineToX);
				this.tlGfx.lineTo(lineToX,y);
			}

		}else{
			this.tlGfx.endFill();
			this.tlGfx.lineStyle(2,color,1);
			this.tlGfx.drawCircle(x,y,w-2);
		}

	}

};
G.ModifyDOMAnimationProp = function(propName,color){

	var animProp = this;

	this.mainDiv = document.createElement('div');

	this.onOffBtn = document.createElement('button');
	this.onOffBtn.innerHTML = 'ON';
	this.mainDiv.appendChild(this.onOffBtn);

	this.label = document.createElement('span');
	this.label.innerHTML = propName;
	this.label.style.color = color;
	this.label.style.fontWeight = 'bold';
	this.label.style.width = '60px';
	this.label.style.display = 'inline-block';
	this.mainDiv.appendChild(this.label);

	this.easingTypeList = document.createElement('select');
	this.easings = ['---','Back','Bounce','Circular','Cubic','Elastic','Exponential','Linear','Quadratic','Quartic','Quintic','Sinusoidal'];
	this.easings.forEach(function(easing){
		var option = document.createElement('option');
		option.setAttribute('value',easing);
		option.innerHTML = easing;
		this.easingTypeList.appendChild(option);
	},this);
	this.mainDiv.appendChild(this.easingTypeList);

	this.easingTypeList.onchange = function(){
		animProp.changeEasing(this.value);
	};

	this.easingSubtypeList = document.createElement('select');
	this.easingSubtypeList.onchange = function(){
		animProp.changeEasingSubtype(this.value);
	};
	this.mainDiv.appendChild(this.easingSubtypeList);

	this.propValue = document.createElement('span');
	this.propValue.innerHTML = '--';
	this.propValue.style.display = 'inline-block';
	this.mainDiv.appendChild(this.propValue);

	this.active = false;


	this.mainDiv.style.position = 'fixed';
	this.mainDiv.style.top = '0';
	this.mainDiv.style.left = '100px';

	document.body.appendChild(this.mainDiv);

	this.currentKeyFrame = {e:[]};

};

G.ModifyDOMAnimationProp.prototype.onOff = function(){

	if (this.active){

		this.active = false;
		this.onOffBtn.innerHTML = 'OFF';
		var index = this.currentObj.propTLS[this.propKey].indexOf(this.currentKeyFrame);
		this.currentObj.propTLS[this.propKey].splice(index,1);	

	}else{

		this.active = true;
		this.onOffBtn.innerHTML = 'ON';

		var newKeyFrame = {
			f: this.currentFrameNr,
			v: G.Utils.getObjProp(this.currentObj.SPR,this.propKey)
		};

		var f = this.currentFrameNr;
		var timeline = this.currentObj.propTLS[this.propKey];

		//why not push and sort??
		var indexToPut = 0;
		for (var i = 0; i < timeline.length; i++){
			if (timeline[i].f < f){
				indexToPut++;
			}
		}

	}

};

G.ModifyDOMAnimationProp.prototype.changeEasing = function(easing){

	if (!this.currentKeyFrame) return;

	if (easing !== '---'){
		this.currentKeyFrame.e[0] = easing;
	}else{
		this.currentKeyFrame.e = [];
		this.refreshSubtypeList();
		this.selectFromList(this.easingSubtypeList,'---');
		return;
	}

	this.selectFromList(this.easingTypeList,easing);

	var currentE1 = this.currentKeyFrame.e[1];
	this.refreshSubtypeList();

	if (!Phaser.Easing[easing][currentE1]){
		this.changeEasingSubtype(Object.keys(Phaser.Easing[easing])[0]);
	}else{
		this.changeEasingSubtype(currentE1);
	}

};

G.ModifyDOMAnimationProp.prototype.changeEasingSubtype = function(subtype){

	console.log('changeSubtype: '+subtype);

	this.selectFromList(this.easingSubtypeList,subtype);
	if (subtype !== '---') this.currentKeyFrame.e[1] = subtype;

};

G.ModifyDOMAnimationProp.prototype.refreshSubtypeList = function(){

	var e = Phaser.Easing[this.easingTypeList.value];

	this.easingSubtypeList.innerHTML = '';

	if (e){

		for (prop in e){
			var option = document.createElement('option');
			option.setAttribute('value',prop);
			option.innerHTML = prop;
			this.easingSubtypeList.appendChild(option);
		}

	}else{

		var option = document.createElement('option');
		option.setAttribute('value','---');
		option.innerHTML = '---';
		this.easingSubtypeList.appendChild(option);

	}

};

G.ModifyDOMAnimationProp.prototype.selectFromList = function(list,value){

	for (var i = 0; i < list.options.length; i++){
		if (list.options[i].value === value){
			list.selectedIndex = i;
			break;
		}
	}

};
if (typeof G === "undefined") G = {};
G.ASSETS = {
  spritesheets: ["ssheet", "ui"],
  sfx: [
    "bubble_hits_bubble.mp3",
    "bubble_hits_wall.mp3",
    "bubble_pops_1.mp3",
    "bubble_pops_2.mp3",
    "bubble_pops_3.mp3",
    "button_click.mp3",
    "lost.mp3",
    "shoot_bubble.mp3",
    "won.mp3",
  ],
  images: [],
  json: ["languages.json"],
  fonts: {},
};

G.Boot = function (game) { };

G.Boot.prototype = {
  init: function () {

    if (typeof SG !== 'undefined') {
      G.lang = SG.lang;
    } else {
      G.lang = 'en';
    }

    if (this.game.device.android && this.game.device.chrome && this.game.device.chromeVersion >= 55) {
      this.game.sound.touchLocked = true;
      this.game.input.addTouchLockCallback(function () {
        if (this.noAudio || !this.touchLocked || this._unlockSource !== null) {
          console.log('no need to unlock');
          return true;
        }
        console.log('usingWebAudio: ', this.usingWebAudio);
        if (this.usingWebAudio) {
          var buffer = this.context.createBuffer(1, 1, 22050);
          this._unlockSource = this.context.createBufferSource();
          this._unlockSource.buffer = buffer;
          this._unlockSource.connect(this.context.destination);

          if (this._unlockSource.start === undefined) {
            this._unlockSource.noteOn(0);
          } else {
            this._unlockSource.start(0);
          }

          //Hello Chrome 55!
          if (this._unlockSource.context.state === 'suspended') {
            this._unlockSource.context.resume();
          }
        }

        //  We can remove the event because we've done what we needed (started the unlock sound playing)
        return true;
      }, this.game.sound, true);
    }

    game.renderer.renderSession.roundPixels = true;

    this.scale.pageAlignHorizontally = true
    this.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
    this.input.maxPointers = 1;
    this.stage.disableVisibilityChange = true;
    game.tweens.frameBased = true;
    game.time.advancedTiming = true;

    this.scaleGameSizeUpdate = function () {
      var standardWidth = game.device.desktop ? G.l(1000) : G.l(640);
      var standardHeight = game.device.desktop ? G.l(800) : G.l(990);

      var ratio = window.innerHeight / window.innerWidth;
      var ratioHeight = Math.floor(standardWidth * ratio);

      game.scale.setGameSize(standardWidth, Math.max(ratioHeight, standardHeight));
      game.world.setBounds(0, 0, game.width, game.height);

      G.sb('onScreenResize').dispatch();
    };

    G.sb = G.SignalBox;
    G.extLoader = new G.ExtLoader(game);

    game.resizeGame = this.scaleGameSizeUpdate;
    this.scale.setResizeCallback(function () {
      if (G.old_w != window.innerWidth || G.old_h != window.innerHeight) {
        G.old_w = window.innerWidth;
        G.old_h = window.innerHeight;
        game.resizeGame();
      }
    });


    G.linePx = 2;
    G.roundCornerPx = 10;
    sdkHandler.trigger('restore', {
      key: 'gmdatastring',
      callback: (error, value) => {
        if (error) {
          console.error(error);
        } else {
          if (value) {
            G.saveStateData = JSON.parse(value);
          } else {
            G.saveStateData = {
              gameLevel: 0,
              // pointerArrow: 0,
              bestScore: [0, 0, 0],
              previousScore: [0, 0, 0],
              mute: false
            }
          }
          // G.saveStateData = JSON.parse(G.saveStateData);
        }
      }
    }, this);

    G.gameLevel = G.saveStateData.gameLevel;
    G.statsGameLevel = G.gameLevel;
    // G.pointerArrow = G.saveStateData.pointerArrow;
    G.bestScore = G.saveStateData.bestScore;
    G.previousScore = G.saveStateData.previousScore;
    game.sound.mute = G.saveStateData.mute;
    G.save = function () {
      sdkHandler.trigger('save', {
        key: 'gmdatastring',
        value: JSON.stringify(G.saveStateData),
        callback: (error) => {
          if (error) console.log(error);
        }
      }, this);
    };
  },

  preload: function () {

  },

  create: function () {
    // document.body.style.backgroundColor = '#30225D';
    document.body.style.backgroundImage = "url('img/Game_Background.jpg')";
    game.resizeGame();
    this.state.start('Preloader');
  }

};
G.Game = function (game) {
  this.GAMESTATE = true;
  G.bubbleNames = ['blue', 'green', 'pink', 'red', 'turquoise', 'yellow'];
  // ATTEMPT TO FIX FPS ISSUE
  // game.lastFrameTime = Date.now();
};

G.Game.prototype = {

  init: function (dataToLoad, ghostData) {

  },

  preload: function () {

  },

  create: function () {

    sdkHandler.trigger('gameStart');

    var config;
    this.gameLevel = G.gameLevel;
    if (game.device.desktop) {
      config = {
        grid: {
          x: 55,
          y: 75,
          sizeW: 17,
          sizeH: 12,
          mobile: false,
          fillTo: 9
        },
        shooter: {
          x: 505,
          y: game.height - 45,
          chances: 5 - this.gameLevel
        }
      }
    } else {
      config = {
        grid: {
          x: 23,
          y: 80,
          sizeW: 11,
          sizeH: 17,
          mobile: true,
          fillTo: 7
        },
        shooter: {
          x: 320,
          y: game.height - 45,
          chances: 5 - this.gameLevel
        }
      }
      if (this.isTab()) {
        config = {
          grid: {
            x: 23,
            y: 80,
            sizeW: 11,
            sizeH: 15,
            mobile: true,
            fillTo: 7
          },
          shooter: {
            x: 320,
            y: window.innerHeight - 490,
            chances: 5 - this.gameLevel
          }
        }
      }
      if (this.isIpad()) {
        config = {
          grid: {
            x: 23,
            y: 80,
            sizeW: 11,
            sizeH: 15,
            mobile: true,
            fillTo: 7
          },
          shooter: {
            x: 320,
            y: window.innerHeight - 45,
            chances: 5 - this.gameLevel
          }
        }
      }
    }

    G.points = 0;
    G.gameOver = false;
    G.sb('gameOver').addOnce(function (won) {
      G.gameOver = true;
      G.sb('pushWindow').dispatch(['gameOver', won]);
    }, this);

    game.delta = 1;

    s = game.state.getCurrentState();
    this.grid = new G.GameGrid(config.grid);
    this.fxLayer = new G.EffectsLayer(this.grid);
    this.shooter = new G.Shooter(498, 700, this.grid, config.shooter);
    if (game.device.desktop) {
      this.ui = new G.GameUI(game.device.desktop);
    } else {
      this.ui = new G.GameUI_Mobile(game.device.mobile);
    }

    this.windowLayer = new G.WindowLayer();
    game.time.events.add(1, game.resizeGame, game);
  },

  render: function () {
    // ATTEMPT TO FIX FPS ISSUE
    // game.delta = (Date.now() - game.lastFrameTime) / 60;
    // game.lastFrameTime = Date.now();
  }
};

// Logic to detect ipad or (samsung browser on android tab)
G.Game.prototype.isTab = function () {
  const toMatch_Mobile = [
    /Mobile/i
  ];
  const isMobile = toMatch_Mobile.every((toMatchItem) => {
    return navigator.userAgent.match(toMatchItem);
  });
  const isTab = !isMobile;

  const toMatch_SamsungBrowser = [
    /SamsungBrowser/i
  ];
  const isSamsungBrowser = toMatch_SamsungBrowser.every((toMatchItem) => {
    return navigator.userAgent.match(toMatchItem);
  });
  const isIpad = /Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints && navigator.maxTouchPoints > 1;

  return (isTab && isSamsungBrowser) || isIpad;
}

G.Game.prototype.isIpad = function () {
  const isIpad = /Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints && navigator.maxTouchPoints > 1;

  return isIpad;
}
G.MainMenu = function(game) {

};

G.MainMenu.prototype = {

  create: function() {

    this.windowLayer = new G.WindowLayer();
    //G.sb('pushWindow').dispatch(['enterYourNickname',true]);

    G.sb('onAllWindowsClosed').add(function() {
      game.state.start('Game');
    });

    game.resizeGame();

  }

};
G.Preloader = function(game) {
  this.ready = false;
};

G.Preloader.prototype = {

  preload: function() {
    this.load.onFileComplete.add(function(progress) {
      sdkHandler.trigger('loading.update',{
        progressPercentage: progress
      });
    });

    G.Loader.loadAssets();
  },

  create: function() {
    G.json = {
      languages: game.cache.getJSON('languages')
    }

    if (typeof SG !== 'undefined') {
      G.lang = SG.lang;
    } else {
      G.lang = window.sgSettings.config.env.locale
    }

    sdkHandler.trigger('loading.completed', {
      callback: (err, userData) => {
        if (err) return console.log('err', err);
        sgSettings.config.user = userData;
      }
    });
  },

  update: function() {

  }

};
G.BestScoreCounter = function (x, y) {
  Phaser.Group.call(this, game);
  this.state = game.state.getCurrentState();

  this.position.setTo(x, y);

  this.background_As_StatsButton = this.addButton(0, 5, 'bg_numbers_hud', '', function () {
    if (G.menuOpened) return;
    G.sfx.button_click.play();
    G.sb('pushWindow').dispatch(['Stats', G.gameLevel]);
  }, this);
  this.background_As_StatsButton.scale.setTo(0.8);

  this.trophyIcon = G.makeImage(-60, 5, 'trophy_gold', 0.5, this);
  this.trophyIcon.scale.setTo(0.7);
  this.add(this.trophyIcon);

  let text = G.bestScore[G.gameLevel].toString();

  txt = new G.OneLineText(20, -3, 'white_font', text, 32, 180, 0.5, 0.5);
  txt.updateCache();
  this.add(txt);
}

G.BestScoreCounter.prototype = Object.create(Phaser.Group.prototype);

G.BestScoreCounter.prototype.ResetCounter = function () {
  let resetScore = 0;
  txt.setText(resetScore.toString());
}

G.BestScoreCounter.prototype.addButton = function (x, y, sprite, text, func, context) {
  var button = new G.Button(x, y, sprite, func, context);
  button.addTextLabel('white_font', text, 40);
  this.add(button);
  return button;
};
G.Bubble = function(grid) {
  Phaser.Sprite.call(this, game, 0, 0, null);
  this.state = game.state.getCurrentState();
  this.anchor.setTo(0.5);
  this.cell = new Phaser.Point(0, 0);
  this.collCircle = new Phaser.Circle(0, 0, 0);
  this.grid = grid;
  this.signalBindings = [];
  this.kill();
}

G.Bubble.prototype = Object.create(Phaser.Sprite.prototype);
G.Bubble.constructor = G.Bubble;

G.Bubble.prototype.isMatchingType = function(type) {
  return this.type == type;
};

G.Bubble.prototype.clearCheck = function() {
  this.checked = false;
};

G.Bubble.prototype.checkType = function(type) {
  if (this.checked) {
    return false;
  } else {
    this.checked = true;
    return this.isMatchingType(type);
  }
};

G.Bubble.prototype.vanish = function() {
  this.grid.vanishBubble(this);
};

G.Bubble.prototype.getWorldPosition = function() {
  return this.grid.cellToOutsidePx(this.cellX, this.cellY);
}

G.Bubble.prototype.getWorldAngle = function() {
  if (this.parent === null) return 0;
  return this.parent.angle + this.angle;
}

G.Bubble.prototype.startBounce = function(velX, velY) {
  G.sb('onBubbleStartBounce').dispatch(this);

  this.scaleBounceTweenCompleted = false;

  this.duringBounce = true;
  this.velX = velX;
  this.velY = velY;

  this.scaleBounceTween = game.add.tween(this.scale).to({
    x: 0.9,
    y: 0.9
  }, 100, Phaser.Easing.Elastic.InOut, true, 0, 0, true);
}

G.Bubble.prototype.update = function() {
  if (!this.alive) return;
  if (this.duringBounce) this.bounceUpdate();
}


G.Bubble.prototype.bounceUpdate = function() {
  if (this.duringBounce && this.alive) {

    this.x += this.velX * game.delta;
    this.y += this.velY * game.delta;
    this.velX *= 0.9;
    this.velY *= 0.9;

    this.pullX = (this.x - this.orgX) * -0.6;
    this.pullY = (this.y - this.orgY) * -0.6;
    this.x += this.pullX;
    this.y += this.pullY;


    if (!this.scaleBounceTween.isRunning && Math.abs(this.x - this.orgX) < 1 && Math.abs(this.y - this.orgY) < 1) {
      this.x = this.orgX;
      this.y = this.orgY
      this.duringBounce = false;
      G.sb('onBubbleFinishBounce').dispatch(this);
    }

  }
};

G.Bubble.prototype.onMatch = function() {
  this.update = this.onMatchUpdate;
  this.grid.moveToMatchGroup(this);
  G.sb('fxMatchParticle').dispatch(this);
  G.sb('fxCircleParticle').dispatch(this);
  G.sb('fxUnderMatch').dispatch(this);
}

G.Bubble.prototype.onMatchUpdate = function() {
  this.scale.setTo(this.scale.x + 0.02);
  this.alpha -= 0.05;
  if (this.alpha < 0) this.inGameDestroy();
}

G.Bubble.prototype.onPopOut = function() {
  this.inGameDestroy();
}


G.Bubble.prototype.inGameDestroy = function() {

  this.kill();
  G.sb('onBubbleObjectDestroy').dispatch(this);

};




G.Bubble.prototype.normalTypes = ['0', '1', '2', '3', '4', '5'];



G.Bubble.prototype.basicInit = function(cx, cy, x, y, type, grid) {

  if (this.overlayImg) this.overlayImg.destroy();

  G.stopTweens(this);
  this.alpha = 1;
  this.scale.setTo(1);
  this.angle = 0;

  //detach all bindings like chameleon color change and shit
  if (this.signalBindings.length > 0) {
    this.signalBindings.forEach(function(signal) {
      signal.detach();
    });
    this.signalBindings = [];
  };

  this.bubbleBooster = false;
  this.x = x;
  this.y = y;
  this.cell.set(cx, cy);
  this.cellX = cx;
  this.cellY = cy;
  this.orgX = x;
  this.orgY = y;
  this.checked = false;
  this.bounceable = true;
  this.bombResistant = false;
  this.special = false;
  this.animated = false;
  this.collCircle.setTo(x, y, G.l(50));
  this.duringBounce = false;
  this.velX = 0;
  this.velY = 0;
  this.pullX = 0;
  this.pullY = 0;

  this.update = G.Bubble.prototype.update;
  this.checkType = G.Bubble.prototype.checkType;
  this.onPut = G.Bubble.prototype.onPut;
  this.onPopOut = G.Bubble.prototype.onPopOut;
  this.onMatchHit = G.Bubble.prototype.onMatchHit;
  this.onHit = G.Bubble.prototype.onHit;
  this.onPreciseHit = G.Bubble.prototype.onPreciseHit;
  this.onPutAfterCheckAndProcessHold = G.Bubble.prototype.onPutAfterCheckAndProcessHold;
  this.onMatch = G.Bubble.prototype.onMatch;
  this.onMatchUpdate = G.Bubble.prototype.onMatchUpdate;

  this.revive();

};



//
//  Regular
//

G.Bubble.prototype.initRegular = function(cx, cy, x, y, type, grid) {
  this.basicInit(cx, cy, x, y, type, grid);

  G.changeTexture(this, 'bubble_' + G.bubbleNames[parseInt(type)]);
  this.type = parseInt(type);
  this.typeName = G.bubbleNames[parseInt(type)];
  this.onMatch = this.onMatchRegular;
  this.onMatchUpdate = this.onMatchUpdateRegular;
};

G.Bubble.prototype.onMatchRegular = function() {

  this.inGameDestroy();

}

G.Bubble.prototype.onMatchUpdateRegular = function() {

  if (this.typeName) {

    if (this.animTimer-- == 0) {
      this.animTimer = 2;
      this.frameIndex++;
      if (this.frameIndex == 9) {
        this.inGameDestroy();
      } else {
        this.loadTexture('burstsheet', 'burst' + this.typeName + this.frameIndex);
      }
    }

  } else {

    this.scale.setTo(this.scale.x + 0.02);
    this.alpha -= 0.05;
    if (this.overlayImg) this.overlayImg.alpha = this.alpha;
    if (this.alpha < 0) this.inGameDestroy();

  }

}
G.BubbleFactory = function(grid) {
  this.grid = grid;
  this.gridArray = grid.gridArray;
  this.neighboursCoordinations = grid.neighboursCoordinations;

  this.colorGroups = ['0', '1', '2', '3', '4'];
  this.freeBubbles = [];

  G.sb('onBubbleObjectDestroy').add(function(bubble) {
    if (bubble.parent && bubble.parent.remove) {
      bubble.parent.remove(bubble);
      this.freeBubbles.push(bubble);
    }
  }, this);
}

G.BubbleFactory.prototype.getFreeBubble = function() {
  if (this.freeBubbles.length > 0) return this.freeBubbles.pop();
  return new G.Bubble(this.grid);
};

G.BubbleFactory.prototype.makeBubble = function(cellX, cellY, type) {
  var createdBubble = 0;
  var pxPos = this.grid.cellToInsidePx(cellX, cellY);
  var freeBubble = this.getFreeBubble();

  freeBubble.initRegular(cellX, cellY, pxPos[0], pxPos[1], type);

  this.gridArray.set(cellX, cellY, freeBubble);
  if (freeBubble.animated) {
    this.grid.nonCacheGroup.add(freeBubble);
  } else {
    this.grid.add(freeBubble);
  }

  return freeBubble;
}
G.BubbleFlying = function(grid) {
  Phaser.Sprite.call(this, game, 0, 0, null);
  this.anchor.setTo(0.5);

  this.grid = grid;
  this.collCircle = new Phaser.Circle(0, 0, G.lnf(25));
  this.spd = G.lnf(12);
  this.cellX = 0;
  this.cellY = 0;
  this.prevCellX = 0;
  this.prevCellY = 0;
  this.neighbours = [];

  this.kill();
}

G.BubbleFlying.prototype = Object.create(Phaser.Sprite.prototype);
G.BubbleFlying.constructor = G.BubbleFlying;

G.BubbleFlying.prototype.update = function() {
  if (!this.alive) return;

  var delta = game.delta;

  this.updatePosition();
  this.fire ? this.updateCollFire() : this.updateColl();
  this.updatePosition();
  this.fire ? this.updateCollFire() : this.updateColl();
  if (delta > 1) {
    this.updatePosition(delta - 1);
    this.fire ? this.updateCollFire() : this.updateColl();
  }
}

G.BubbleFlying.prototype.init = function(x, y, angle, type) {
  this.x = x;
  this.y = y;
  this.collCircle.diameter = G.lnf(25);
  this.cellX = -99999;
  this.cellY = -99999;
  this.alpha = 1;
  this.type = type.toString();
  this.velX = G.lengthDirX(angle, this.spd, false);
  this.velY = G.lengthDirY(angle, this.spd, false);

  this.minX = this.grid.gridFiledRect.x + G.l(45);
  this.maxX = this.grid.gridFiledRect.x + this.grid.gridFiledRect.width - G.l(45);

  this.minY = G.l(this.grid.gridFiledRect.y);
  this.maxY = y;

  G.changeTexture(this, 'bubble_' + G.bubbleNames[parseInt(type)]);

  this.revive();
};

G.BubbleFlying.prototype.updateColl = function() {
  if (!this.alive) return;

  var coll = this.grid.checkCollisionAgainst(this, this.neighbours);
  if (coll.length > 0) {
		if (this.grid.getBubble(this.cellX, this.cellY)) {
      //this.grid.bounceBubbles(this.cellX,this.cellY,this.velX,this.velY);
      this.cellX = this.prevCellX;
      this.cellY = this.prevCellY;
    }

    //so move recorder can catch and make walkthroughEndPoint
    G.sb('flyingBubbleToBePut').dispatch(this);
    this.grid.putBubble(this);
    this.kill();
  }
};


G.BubbleFlying.prototype.afterPutEmpty = function() {};

G.BubbleFlying.prototype.updatePosition = function(deltaTime) {
  if (!this.alive) return;

  var delta = deltaTime || 1;

  this.x += this.velX * delta;
  this.y += this.velY * delta;

  if (this.x < this.minX || this.x > this.maxX) {
    var offset = this.x < this.minX ? this.minX - this.x : this.maxX - this.x;
    this.x = game.math.clamp(this.x, this.minX, this.maxX) + offset;
    this.velX *= -1;
    G.sfx.bubble_hits_wall.play();
    //game.sfx['hit_'+game.rnd.between(1,3)].play();
  }

  if (this.y > this.maxY) {
    this.alpha -= 0.07;
    if (this.alpha < 0) {
      this.kill();
    }
  }

  var cellPos = this.grid.outsidePxToCell(this.x, this.y);

  if (this.cellX != cellPos[0] || this.cellY != cellPos[1]) {
    this.prevCellX = this.cellX;
    this.prevCellY = this.cellY;
    this.cellX = cellPos[0];
    this.cellY = cellPos[1];
    this.neighbours = this.grid.getNeighbours(cellPos[0], cellPos[1]);
  }
};


G.BubbleFlying.prototype.getInsideGridPx = function() {
  return this.grid.cellToInsidePx(this.cellX, this.cellY);
};
G.ButtonPanel = function(x, y) {
  Phaser.Group.call(this, game);

  this.x = x;
  this.y = y;

  this.btnsOffset = 100;


  this.setupBtn = new G.Button(0, 0, 'button_turquoise', function() {
    game.state.getCurrentState().windowLayer.open('windowSetup');
  });
  this.setupBtn.addTextLabel('Setup');

  this.restartBtn = new G.Button(-this.btnsOffset, -this.btnsOffset, 'button_green', () => {
    var state = game.state.getCurrentState();      
    sdkHandler.trigger('gameOver', {
      score: state.pointCounter.score
    })

    game.state.start("Game");

    sdkHandler.trigger('gameStart');

  });
  this.restartBtn.addTextLabel('Restart');

  this.helpBtn = new G.Button(this.btnsOffset, -this.btnsOffset, 'button_pink', function() {
    game.state.getCurrentState().windowLayer.open('windowHelp');
  });
  this.helpBtn.addTextLabel('Help');

  this.addMultiple([this.setupBtn /*,this.top10Btn*/ , this.moreGamesBtn, this.restartBtn, this.helpBtn])


  G.sb('onWindowOpened').add(function() {
    this.children.forEach(function(e) {
      e.inputEnabled = false;
    }, this)
  }, this);
  G.sb('onWindowClosed').add(function() {
    this.children.forEach(function(e) {
      e.inputEnabled = true;
      e.input.useHandCursor = true;
    }, this)
  }, this);
}

  G.ButtonPanel.prototype = Object.create(Phaser.Group.prototype);
G.DifficultyLabel = function (x, y) {
  Phaser.Group.call(this, game);
  this.state = game.state.getCurrentState();

  this.position.setTo(x, y);

  this.background_As_DifficultyLevelButton = this.addButton(0, 5, 'bg_numbers_hud', '', function () {
    if (G.menuOpened) return;
    G.sfx.button_click.play();
    G.sb('pushWindow').dispatch('Settings');
  }, this);
  this.background_As_DifficultyLevelButton.scale.setTo(0.8);

  let difficultyLevelString = "";
  switch (G.gameLevel) {
    case 0:
      difficultyLevelString = G.txt(9);
      break;
    case 1:
      difficultyLevelString = G.txt(10);
      break;
    case 2:
      difficultyLevelString = G.txt(11);
      break;
    default:
      break;
  }

  this.txt = new G.OneLineText(5, -3, 'white_font', difficultyLevelString, 28, 180, 0.5, 0.55);
  this.txt.updateCache();
  this.add(this.txt);
}

G.DifficultyLabel.prototype = Object.create(Phaser.Group.prototype);

G.DifficultyLabel.prototype.addButton = function (x, y, sprite, text, func, context) {
  var button = new G.Button(x, y, sprite, func, context);
  button.addTextLabel('white_font', text, 40);
  this.add(button);
  return button;
};
G.EffectsLayer = function(grid) {
  Phaser.Group.call(this, game);
  this.x = grid.x;
  this.y = grid.y;

  this.queue = [];

  this.timer = 0;

  G.sb('fxRemoveBubbles').add(function(list) {
    for (var i = 0, len = list.length; i < len; i++) {
      var freeFxBubble = this.getFirstDead() || this.add(new G.EffectPart());
      freeFxBubble.init(list[i], i * 4);
    }
  }, this);
}

G.EffectsLayer.prototype = Object.create(Phaser.Group.prototype);

G.EffectPart = function() {
  Phaser.Image.call(this, game);

  this.anchor.setTo(0.5);
  this.kill();
  this.animIndex = 1;
  this.delay = 0;
}

G.EffectPart.prototype = Object.create(Phaser.Image.prototype);

G.EffectPart.prototype.init = function(bubble, delay) {
  this.revive();

  this.pointsToAdd = bubble.pointsAfterBurst;
  this.x = bubble.x;
  this.y = bubble.y;
  this.animIndex = 1;
  this.delay = delay;
  this.soundPlayed = false;

  G.changeTexture(this, bubble.frameName);
  this.initGfx = bubble.frameName;
};

G.EffectPart.prototype.update = function() {
  if (!this.alive) return;

  this.delay--;

  if (this.delay <= 0) {

    if (!this.soundPlayed) {
      G.sb('onAddPoints').dispatch(this.pointsToAdd);
      this.soundPlayed = true;
      if (!G.gameOver) G.sfx['bubble_pops_' + game.rnd.between(1, 3)].play();
    }

    this.animIndex += 0.4;

    if (this.animIndex >= 7) {
      this.kill();
    } else {
      G.changeTexture(this, this.initGfx + '_0' + Math.floor(this.animIndex));
    }
  }
};
G.GameGrid = function(config) {

  if (config.mobile) {
    this.bg = G.makeImage(config.x - 1, config.y - 1, 'gamefield_p', 0);
    let scaleY = game.height / 890
    this.bg.scale.x = 1.07;
    this.bg.scale.y = scaleY;
    if (G.Game.prototype.isTab()) {
      this.bg.scale.y = 1.1;
    }
  } else {
      //desktop
      this.bg = G.makeImage(config.x - 1, config.y - 3, 'gamefield_l', 0);
      this.bg.scale.y = 0.98;
    }
    this.bg.width += 20;
    this.bg.position.x -= 10;
    this.bg.height -= 12;
    this.bg.position.y -= 7;

    Phaser.Group.call(this, game);

    this.x = config.x;
    this.y = config.y;

    this.state = game.state.getCurrentState();

    this.gameOverTimer = 0;

    G.bubblesPopped = 0;

    this.offsetX = 0;
    this.offsetY = 0;
    this.gridArray = new G.GridArray();
    this.nonCacheGroup = game.add.group();
    this.nonCacheGroup.grid = this;
    this.matchGroup = game.add.group();
    this.popOutGroup = null;

    this.bubbleFactory = new G.BubbleFactory(this);

    this.cellW = G.l(51);
    this.cellH = G.l(50);

    this.sizeW = config.sizeW;
    this.sizeH = config.sizeH;

    this.gridFiledRect = new Phaser.Rectangle(this.x - 15, this.y, this.sizeW * this.cellW + (this.cellW * 0.5) + 30, (this.sizeH + 1) * this.cellH);
    this.gridFiledRect.offset = G.l(2);
    this.gridFiledRect.radius = G.l(10);


    this.holds = [];
    this.cachingCelling = true;

    this.generateLevel(config.fillTo);

    this.maxY = G.l(400);
    this.targetY = this.getTargetY();

    this.moveDelay = 0;
    this.oldHeight = this.height;

    this.caching = true;
    this.orderCacheAfterUpdate = false;
    this.recacheBitmap();

  //this.forEach(function(child) {if (child.cellY < 45) child.visible = false});

  G.sb('onBubblePutToGrid').add(function() {
    if (this.height == this.oldHeight) return;
    this.targetY = this.getTargetY();
    this.oldHeight = this.height;
  }, this);

  G.sb('onBubblesMatch').add(function(match) {
    G.bubblesPopped += match.length;
  }, this);

  G.sb('onBubbleDestroyed').add(function() {
    if (this.height == this.oldHeight) return;
    this.targetY = this.getTargetY();
    this.oldHeight = this.height;
    this.moveDelay = 30;
  }, this);


  G.sb('onBubbleStartBounce').add(function(bubble) {
    if (!G.animated) {
      this.nonCacheGroup.add(bubble);
    }
  }, this);

  G.sb('onBubbleFinishBounce').add(function(bubble) {
    if (!G.animated) {
      this.add(bubble);
    }
    this.orderCacheAfterUpdate = true;
  }, this);

  G.sb('requestDestroy').add(function(bubble) {
    this.destroyBubbles([bubble]);
    this.checkAndProcessHold();
  }, this);

  G.sb('onBubbleObjectDestroy').add(function(bubble) {
    this.gridArray.set(bubble.cellX, bubble.cellY, null);
  }, this);

  //this.drawRoundedRectangle();

  if (config.mobile) {
    G.overlayImage = G.makeImage(config.x - 1, config.y - 1, "shadow_gamefield_p", 0);
    let scaleY = game.height / 890
    G.overlayImage.scale.x = 1.07;
    G.overlayImage.scale.y = scaleY;
    if (G.Game.prototype.isTab()) {
      G.overlayImage.scale.y = 1.1;
    }
  } else {
      //desktop
      G.overlayImage = G.makeImage(config.x - 1, config.y - 3, "shadow_gamefield_l", 0);
      G.overlayImage.scale.y = 0.98;
    }

    G.overlayImage.width += 20;
    G.overlayImage.position.x -= 10;
    G.overlayImage.height -= 12;
    G.overlayImage.position.y -= 7;

    G.overlayImage.visible = false;

}

G.GameGrid.prototype = Object.create(Phaser.Group.prototype);
G.GameGrid.constructor = G.GameGrid;



G.GameGrid.prototype.drawRoundedRectangle = function() {

  this.boardGfx.beginFill(0x000000, 0.05);
  this.boardGfx.lineStyle(G.linePx, 0xffffff, 1);
  var offset = this.gridFiledRect.offset;
  var x = this.gridFiledRect.x - offset;
  var y = this.gridFiledRect.y - offset;
  var width = this.gridFiledRect.width + (offset * 2);
  var height = this.gridFiledRect.height + (offset * 2);
  var radius = G.roundCornerPx;


  this.boardGfx.moveTo(x + radius, y);
  this.boardGfx.lineTo(x + width - radius, y);
  this.boardGfx.quadraticCurveTo(x + width, y, x + width, y + radius);
  this.boardGfx.lineTo(x + width, y + height - radius);
  this.boardGfx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  this.boardGfx.lineTo(x + radius, y + height);
  this.boardGfx.quadraticCurveTo(x, y + height, x, y + height - radius);
  this.boardGfx.lineTo(x, y + radius);
  this.boardGfx.quadraticCurveTo(x, y, x + radius, y);
  this.boardGfx.endFill();

  this.makeRefillNextUpdate = -1;

};


G.GameGrid.prototype.getTargetY = function() {
  return Math.min(0, this.maxY - this.height);
}

G.GameGrid.prototype.update = function() {
  this.nonCacheGroup.y = this.y;
  this.nonCacheGroup.x = this.x;
  this.matchGroup.y = this.y;


  if (G.gameOver && this.children.length > 0 && this.gameOverTimer++ % 6 == 0) {



    var bubble = game.rnd.pick(this.children);

    bubble.inGameDestroy();
    bubble.pointsAfterBurst = 0;
    G.sb('fxRemoveBubbles').dispatch([bubble]);
    this.orderCacheAfterUpdate = true;

  }



}

G.GameGrid.prototype.postUpdate = function() {

  if (this.fixedToCamera) {
    this.x = this.game.camera.view.x + this.cameraOffset.x;
    this.y = this.game.camera.view.y + this.cameraOffset.y;
  }

  var i = this.children.length;

  while (i--) {
    this.children[i].postUpdate();
  }

  if (this.orderCacheAfterUpdate) {
    this.recacheBitmap();
  }

};

G.GameGrid.prototype.updateChildren = function() {
  var len = this.length;
  for (var i = 0; i < len; i++) {
    this.children[i].update();
  }
}

G.GameGrid.prototype.makeBubble = function(x, y, type) {
  this.orderCacheAfterUpdate = true;
  return this.bubbleFactory.makeBubble(x, y, type);
}

G.GameGrid.prototype.makeBubbleFromFlyingBubble = function(flyingBubble) {

  if (this.getBubble(flyingBubble.cellX, flyingBubble.cellY)) {

  }


  this.prepareBubbleToBePut(flyingBubble);

  var newBubble = this.makeBubble(flyingBubble.cellX, flyingBubble.cellY, flyingBubble.type);

  var xx = flyingBubble.x;
  var yy = flyingBubble.y;
  newBubble.x = flyingBubble.x - this.x;
  newBubble.y = flyingBubble.y;
  newBubble.velX = flyingBubble.velX;
  newBubble.velY = flyingBubble.velY;

  return newBubble;

};

G.GameGrid.prototype.isSpaceFreePx = function(px, py) {
  var cell = this.outsidePxToCell(px, py);
  return this.isSpaceFree(cell[0], cell[1]);
}


G.GameGrid.prototype.isSpaceFree = function(cx, cy) {
  return this.getBubble(cx, cy) ? false : true;
}

G.GameGrid.prototype.outsidePxToCell = function(x, y) {
  return this.insidePxToCell(x - this.x, y - this.y);
}

G.GameGrid.prototype.insidePxToCell = function(x, y) {

  var clean;

  y += G.l(6);

  if (y < 0) {
    clean = y % this.cellH > G.l(-34);
  } else {
    clean = y % this.cellH > G.l(17);
  }

  var xx, yy, modX, modY;

  yy = Math.floor(y / this.cellH);

  if (!clean) {

    modX = yy % 2 == 0 ? x % this.cellW : (x - (this.cellW * 0.5)) % this.cellW;
    modX = modX < 0 ? this.cellW + modX : modX;
    modY = y > 0 ? y % this.cellH : this.cellH - Math.abs(y % this.cellH);

    if (modX + modY < G.l(23) || modX + modY > G.l(52)) {
      yy--;
    }

    if (yy % 2 == 0) {
      xx = Math.floor(x / this.cellW);
    } else {
      xx = Math.floor((x - (this.cellW * 0.5)) / this.cellW)
    }

  } else {
    if (yy % 2 == 0) {
      xx = Math.floor(x / this.cellW);
    } else {
      xx = Math.floor((x - (this.cellW * 0.5)) / this.cellW)
    }
  }

  return [xx, yy];


}


G.GameGrid.prototype.cellToInsidePx = function(x, y) {

  if (y % 2 == 0) {
    return [Math.floor(x * this.cellW + (this.cellW * 0.5) - this.offsetX), Math.floor(y * this.cellH + (this.cellW * 0.5) - this.offsetY)];
  } else {
    return [Math.floor(x * this.cellW + this.cellW - this.offsetX), Math.floor(y * this.cellH + (this.cellW * 0.5) - this.offsetY)];
  }

}

G.GameGrid.prototype.cellToOutsidePx = function(x, y) {


  var pos = this.cellToInsidePx(x, y);
  pos[1] += this.y;

  return pos;

}



G.GameGrid.prototype.putBubble = function(flyingBubble) {



  var newBubble = this.makeBubbleFromFlyingBubble(flyingBubble);
  var xx = newBubble.cellX;
  var yy = newBubble.cellY;

  G.sb('onBubblePutToGrid').dispatch(newBubble);

  if (this.getBubble(xx, yy)) {
    var matching = this.getMatching(xx, yy, newBubble.type);

    if (matching.length > 2) {
      matching.forEach(function(e) {
        e.inGameDestroy();
      });
    } else {
      this.bounceBubbles(newBubble);
      matching = [];
    }
  }




  var popOuts = this.checkAndProcessHold();

  popOuts.forEach(function(e) {
    e.inGameDestroy();
  });

  matching.forEach(function(e, index) {
    e.pointsAfterBurst = (Math.floor(index / 3) + 1) * 10;
  });

  popOuts.forEach(function(e, index) {
    e.pointsAfterBurst = (Math.floor(index / 3) + 1) * 100;
  });


  G.sb('onBubblesMatch').dispatch(matching);
  G.sb('onBubblesPopOut').dispatch(popOuts);

  var toDestroy = matching.concat(popOuts);

  if (toDestroy.length == 0) {
    G.sfx.bubble_hits_bubble.play();
  }

  G.sb('fxRemoveBubbles').dispatch(toDestroy);

  G.sb('onMoveDone').dispatch(toDestroy.length > 0);

  this.orderCacheAfterUpdate = true;

  var lowestB = s.grid.getLowestBubble();
  if (lowestB >= this.sizeH && lowestB) {
    G.sb('gameOver').dispatch();
  }

  if (this.children.length == 0 && this.nonCacheGroup.children.length == 0) {
    G.sb('gameOver').dispatch(true);
  }

}


G.GameGrid.prototype.prepareBubbleToBePut = function(bubble) {
  bubble.y -= this.y;
}


G.GameGrid.prototype.outsidePxToInsidePx = function(x, y) {
  return [x, y - this.y];
}


G.GameGrid.prototype.checkCollisionAgainst = function(bubble, against, allColl) {

  var circle = this.prepareBubbleCollCircleToCollCheck(bubble);

  against.push(this.getBubble(bubble.cellX, G.cellY));

  var coll = [];

  if (this.cachingCelling && bubble.cellY == 0) return [bubble.cellX, bubble.cellY];

  for (var i = 0; i < against.length; i++) {
    if (against[i] && Phaser.Circle.intersects(circle, against[i].collCircle)) {
      if (allColl) {
        coll.push(against[i]);
      } else {
        return [against[i].cellX, against[i].cellY];
      }

    }
  }

  return coll;
};

G.GameGrid.prototype.prepareBubbleCollCircleToCollCheck = function(bubble) {
  var circle = bubble.collCircle
  circle.x = bubble.x - this.x + bubble.velX;
  circle.y = bubble.y - this.y + bubble.velY;
  return bubble.collCircle;
};

G.GameGrid.prototype.getPreciseHits = function(bubble) {


  var oldDiameter = bubble.collCircle.diameter;
  var oldX = bubble.collCircle.x;
  var oldY = bubble.collCircle.y;

  var neighbours = this.getNeighbours(bubble.cellX, bubble.cellY);
  neighbours.push(this.getBubble(bubble.cellX, bubble.cellY));
  var circle = this.prepareBubbleCollCircleToCollCheck(bubble);
  bubble.collCircle.x = bubble.x;
  bubble.collCircle.y = bubble.y;
  bubble.collCircle.diameter = bubble.l(50);

  var result = [];

  for (var i = 0; i < neighbours.length; i++) {
    if (neighbours[i] && Phaser.Circle.intersects(circle, neighbours[i].collCircle)) {
      result.push(neighbours[i]);
    }
  }

  bubble.collCircle.x = oldX;
  bubble.collCircle.y = oldY;
  bubble.collCircle.diameter = oldDiameter;

  return result;
};

G.GameGrid.prototype.hitNeighboursOf = function(bubble) {

  this.getNeighbours(bubble.cellX, bubble.cellY).forEach(function(child) {
    child.onHit(bubble);
  });

}


G.GameGrid.prototype.getBubble = function(cellX, cellY) {
  return this.gridArray.get(cellX, cellY);
}

G.GameGrid.prototype.neighboursCoordinations = [
[
[-1, -1],
[-1, 0],
[-1, 1],
[0, -1],
[0, 1],
[1, 0]
],
[
[0, -1],
[-1, 0],
[0, 1],
[1, -1],
[1, 1],
[1, 0]
]
]

G.GameGrid.prototype.outerRingCoordinations = [
  //[[0,-2],[1,-2],[1,-1],[2,0],[1,1],[1,2],[0,2],[-1,2],[-2,1],[-2,0],[-2,-1],[-1,-2]],
  [
  [0, -2],
  [-1, -2],
  [1, -1],
  [2, 0],
  [1, 1],
  [1, -2],
  [1, 2],
  [0, 2],
  [-1, 2],
  [-2, 1],
  [-2, 0],
  [-2, -1]
  ],

  //[[0,-2],[1,-2],[2,-1],[2,0],[2,1],[1,2],[0,2],[-1,2],[-1,1],[-2,0],[-1,1],[-1,-2]]
  [
  [-1, -2],
  [0, -2],
  [1, -2],
  [2, -1],
  [2, 0],
  [2, 1],
  [1, 2],
  [0, 2],
  [-1, 2],
  [-1, 1],
  [-2, 0],
  [-1, -1]
  ]
  ]

  G.GameGrid.prototype.getNeighbours = function(cellX, cellY) {

    var result = [];

    this.neighboursCoordinations[Math.abs(cellY % 2)].forEach(function(coords) {

      var bubble = this.getBubble(cellX + coords[0], cellY + coords[1]);
      if (bubble) {
        result.push(bubble);
      }
    }, this);

    return result;

  }

  G.GameGrid.prototype.getOuterRing = function(cellX, cellY) {

    var result = [];

    this.outerRingCoordinations[Math.abs(cellY % 2)].forEach(function(coords) {
      var bubble = this.getBubble(cellX + coords[0], cellY + coords[1]);
      if (bubble) {
        result.push(bubble);
      }
    }, this);
    return result;

  }


  G.GameGrid.prototype.getFreeSpacesAround = function(cellX, cellY) {

    var result = [];

    this.neighboursCoordinations[Math.abs(cellY % 2)].forEach(function(coords) {

      if (!this.getBubble(cellX + coords[0], cellY + coords[1])) {

        var xx = cellX + coords[0];
        var yy = cellY + coords[1];

        if (!this.ghostMode && yy < 0) {
          return;
        }

        if (yy % 2 == 0) {
          if (xx >= 0 && xx < 11) {
            result.push([xx, yy]);
          }
        } else {
          if (xx >= 0 && xx < 10) {
            result.push([xx, yy]);
          }
        }

      }

    }, this);

    return result;

  }



  G.GameGrid.prototype.getMatching = function(cellX, cellY, type) {

    if (type == "multicolor") {
      return this.getMatchingMulticolor(cellX, cellY)
    };


    this.clearCheck();

    var toCheck = [
    [cellX, cellY]
    ];
    var toCheckIndex = 0;

    if (!this.getBubble(cellX, cellY)) return false;

    var found = [this.getBubble(cellX, cellY)];
    this.getBubble(cellX, cellY).checked = true;

    while (toCheckIndex < toCheck.length) {

      var bubble = this.getBubble(toCheck[toCheckIndex][0], toCheck[toCheckIndex][1]);
      toCheckIndex++;
      var neighbours = this.getNeighbours(bubble.cellX, bubble.cellY);
      for (var i = 0; i < neighbours.length; i++) {
        if (neighbours[i] && neighbours[i].checkType(type)) {
          found.push(neighbours[i]);
          toCheck.push([neighbours[i].cellX, neighbours[i].cellY]);
        }
      }

    }

    return found;
  }

  G.GameGrid.prototype.getMatchingMulticolor = function(cellX, cellY) {

    var result = [];
    var neighbours = this.getNeighbours(cellX, cellY);
    var colorsOfNeighbours = [];

    neighbours.forEach(function(bubble) {
      if (bubble.type.length == 1 && colorsOfNeighbours.indexOf(bubble.type) == -1) {
        colorsOfNeighbours.push(bubble.type);
      }
    });

    colorsOfNeighbours.forEach(function(color, index) {
      var match = this.getMatching(cellX, cellY, color);

      match.splice(0, 1);
      result = Array.prototype.concat(result, match);
    }, this);

    result.push(this.getBubble(cellX, cellY));

    return result;

  }


  G.GameGrid.prototype.clearCheck = function() {

    this.forEach(function(child) {
      child.clearCheck();
    });
    this.nonCacheGroup.forEach(function(child) {
      child.clearCheck();
    });

  }

  G.GameGrid.prototype.processMatching = function(match) {

    G.sb('onBubblesMatch').dispatch(match);
    match.forEach(function(bubble) {
      bubble.onMatch();
    })

    this.hitMatchNeighbours(match);

  }


  G.GameGrid.prototype.hitMatchNeighbours = function(match) {

    var matchNeighbours = []


    match.forEach(function(bubble) {

      var matchNeighboursArray = matchNeighbours;
      var matchArray = match;

      this.getNeighbours(bubble.cellX, bubble.cellY).forEach(function(neighbour) {

        if (matchArray.indexOf(neighbour) == -1 && matchNeighboursArray.indexOf(neighbour) == -1) {
          matchNeighboursArray.push(neighbour);
        }

      });

    }, this);

    matchNeighbours.forEach(function(bubble) {
      bubble.onMatchHit();
    })

  }


  G.GameGrid.prototype.destroyBubbles = function(array) {

    array.forEach(function(child) {
      this.gridArray.set(child.cellX, child.cellY, null);
      child.destroy();
      G.sb('onBubbleDestroyed').dispatch(child);
    }, this);

    this.orderCacheAfterUpdate = true;

  }

  G.GameGrid.prototype.outOfGrid = function(arg) {

    array.forEach(function(child) {
      this.gridArray.set(child.cellX, child.cellY, null);
      G.sb('onBubbleDestroyed').dispatch(child);
    }, this);

    this.orderCacheAfterUpdate = true;

  }

  G.GameGrid.prototype.popOutBubbles = function(list) {
    if (list.length == 0) return;

  //game.sfx.pop.play();
  G.sb('onBubblesPopOut').dispatch(list);
  list.forEach(function(bubble) {
    bubble.onPopOut();
  });

  this.orderCacheAfterUpdate = true;
};

G.GameGrid.prototype.checkAndProcessHold = function() {

  this.checkHold();
  return this.getAllNotChecked();

};


G.GameGrid.prototype.checkHold = function() {

  this.clearCheck();

  this.holds.forEach(function(child) {
    this.holdCheckFrom(child[0], child[1]);
  }, this);

}

G.GameGrid.prototype.holdCheckFrom = function(cellX, cellY) {

  if (!this.getBubble(cellX, cellY)) return;
  if (this.getBubble(cellX, cellY).checked) return;

  var toCheck = [
  [cellX, cellY]
  ];
  var toCheckIndex = 0;
  this.getBubble(cellX, cellY).checked = true;

  while (toCheckIndex < toCheck.length) {

    var bubble = this.getBubble(toCheck[toCheckIndex][0], toCheck[toCheckIndex][1]);
    toCheckIndex++;

    var neighbours = this.getNeighbours(bubble.cellX, bubble.cellY);

    for (var i = 0; i < 6; i++) {
      if (neighbours[i] && !neighbours[i].checked) {
        neighbours[i].checked = true;
        toCheck.push([neighbours[i].cellX, neighbours[i].cellY]);
      }
    }

  }

}

G.GameGrid.prototype.getAllNotChecked = function() {
  var notChecked = [];
  this.forEach(function(child) {
    if (!child.checked) notChecked.push(child);
  });
  this.nonCacheGroup.forEach(function(child) {
    if (!child.checked) notChecked.push(child);
  });
  return notChecked;
}



G.GameGrid.prototype.bounceBubbles = function(bubble) {

  //var neighbours = this.getNeighbours(bubble.cellX,bubble.cellY);

  //var distance = game.math.distance(0,0,bubble.velX,bubble.velY)*0.25;

  bubble.startBounce(bubble.velX * 0.5, bubble.velY * 0.5);

  /*neighbours.forEach(function(child) {
    
    var angle = game.math.angleBetween(bubble.x,bubble.y,child.x,child.y);
    var distanceOffset = child.collCircle.diameter-game.math.distance(bubble.x,bubble.y,child.x,child.y);
    var distanceMultiplier = distanceOffset < 0 ? 0.5 : 1;
    var velX = G.lengthDirX(angle,distance*distanceMultiplier,true); 
    var velY = G.lengthDirY(angle,distance*distanceMultiplier,true); 
    child.startBounce(velX,velY);

  });*/

}


G.GameGrid.prototype.generateLevel = function(fillTo) {

  for (var row = 0; row < fillTo; row++) {
    for (var coll = 0, len = this.sizeW; coll < len; coll++) {
      this.makeBubble(coll, row, game.rnd.between(0, 5));
      if (row == 0) this.holds.push([coll, row]);
    }
  }

};


G.GameGrid.prototype.parseLevel = function(lvl) {

  var elements = lvl.level;
  var offsetX = 0;
  var offsetY = 0;

  if (lvl.mode == "Ghost") {

    elements.forEach(function(element) {
      if (element[2] === 'GHOST') {
        offsetX = element[0] * -1;
        offsetY = element[1] * -1;
      }
    });

    this.cachingCelling = false;
    this.x = (offsetX * this.cellW * -1) + this.offsetX;
    this.y = (offsetY * this.cellH * -1) + this.offsetY;
    this.holds.push([0, 0]);
  }

  elements.forEach(function(element) {

    if (element[2].slice(0, 6) == "SHIELD") {
      this.holds.push([element[0], element[1]]);
      this.cachingCelling = false;
    }

    this.makeBubble(element[0] + offsetX, element[1] + offsetY, element[2]);


  }, this);

  if (lvl.mode == "Classic" || lvl.mode == 'Animals') {

    this.holds = [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [5, 0],
    [6, 0],
    [7, 0],
    [8, 0],
    [9, 0],
    [10, 0]
    ];

  } else if (lvl.mode == 'Boss') {

    this.activeTheLowestShield();

  }

}

G.GameGrid.prototype.getAllColorsOnBoard = function() {
  var result = [];

  this.forEach(function(child) {

    if (child.type == 0 || child.type == 1 || child.type == 2 || child.type == 3 || child.type == 4 || child.type == 5) {
      if (child.special == 'cham') return;
      if (result.indexOf(child.type) == -1) {
        result.push(child.type);
      }
    } else if (child.type.slice(0, 7) == "SHIELD_") {
      if (result.indexOf(child.color) == -1) {
        result.push(child.color);
      }
    }
  });

  this.nonCacheGroup.forEach(function(child) {

    if (child.type == 0 || child.type == 1 || child.type == 2 || child.type == 3 || child.type == 4 || child.type == 5) {
      if (child.special == 'cham') return;
      if (result.indexOf(child.type) == -1) {
        result.push(child.type);
      }
    } else if (child.type.slice(0, 7) == "SHIELD_") {
      if (result.indexOf(child.color) == -1) {
        result.push(child.color);
      }
    }
  });

  return result;
};

G.GameGrid.prototype.activeTheLowestShield = function() {

  var lowestShield = null;

  this.nonCacheGroup.forEach(function(bubble) {

    if (bubble.type.slice(0, 7) == "SHIELD_") {

      if (lowestShield === null) {
        lowestShield = bubble;
      } else {
        lowestShield = bubble.cellY > lowestShield.cellY ? bubble : lowestShield;
      }

    }

  });

  this.forEach(function(bubble) {

    if (bubble.type.slice(0, 7) == "SHIELD_") {

      if (lowestShield === null) {
        lowestShield = bubble;
      } else {
        lowestShield = bubble.cellY > lowestShield.cellY ? bubble : lowestShield;
      }

    }

  });



  if (lowestShield) {
    lowestShield.activateShield();
  }

};

G.GameGrid.prototype.recacheBitmap = function() {
  if (!this.caching) return;
  this.orderCacheAfterUpdate = false;
  this.updateCache();
}

G.GameGrid.prototype.vanishBubble = function(bubble) {
  this.gridArray.set(bubble.cellX, bubble.cellY, null);
  bubble.inGameDestroy();
};

G.GameGrid.prototype.moveToPopOutGroup = function(bubble) {
  this.gridArray.set(bubble.cellX, bubble.cellY, null);
  bubble.rotation = this.rotation;
  this.popOutGroup.add(bubble);
  G.sb('onBubbleOutOfGrid').dispatch(bubble);
}

G.GameGrid.prototype.moveToMatchGroup = function(bubble) {
  this.gridArray.set(bubble.cellX, bubble.cellY, null);
  bubble.rotation = this.rotation;
  this.matchGroup.add(bubble);
  G.sb('onBubbleOutOfGrid').dispatch(bubble);

}

G.GameGrid.prototype.moveToNonCacheGroup = function(bubble) {
  this.nonCacheGroup.add(bubble);
  this.orderCacheAfterUpdate = true;
}

G.GameGrid.prototype.moveToCacheGroup = function(bubble) {
  this.add(bubble);
  this.orderCacheAfterUpdate = true;
}

G.GameGrid.prototype.getLowestBubble = function() {
  var lowest = 0;
  this.forEach(function(bubble) {
    if (bubble.cellY > lowest) {
      lowest = bubble.cellY;
    }
  });
  this.nonCacheGroup.forEach(function(bubble) {
    if (bubble.cellY > lowest) {
      lowest = bubble.cellY;
    }
  });

  return lowest;
}

G.GameGrid.prototype.getBubblesInRange = function(min, max) {
  var result = [];

  this.forEach(function(bubble) {
    if (bubble.cellY >= min && bubble.cellY <= max) {
      result.push(bubble);
    }
  });

  this.nonCacheGroup.forEach(function(bubble) {
    if (bubble.cellY >= min && bubble.cellY <= max) {
      result.push(bubble);
    }
  });

  return result;
};


G.GameGrid.prototype.fillRandomInSecondRow = function() {

  var rnd = Math.floor(Math.random() * 10);
  var colors = this.getAllColorsOnBoard();
  var index;


  for (var i = 0; i < 10; i++) {
    index = (i + rnd) % 10;
    if (this.getBubble(index, 1) === null) {
      return this.makeBubble(index, 1, colors[Math.floor(Math.random() * colors.length)]);
    }
  }

};

//ENDLESS

G.GameGrid.prototype.makeRefill = function(data) {
  var rowsToRefill = 7 - s.grid.getAllColorsOnBoard().length;

  this.moveAllBubblesDown(rowsToRefill);
  this.fillTopRows(rowsToRefill);

  var popOuts = this.checkAndProcessHold();

  popOuts.forEach(function(e) {
    e.inGameDestroy();
  });
  popOuts.forEach(function(e, index) {
    e.pointsAfterBurst = 100;
  });
  var toDestroy = popOuts;
  G.sb('fxRemoveBubbles').dispatch(toDestroy);
  this.orderCacheAfterUpdate = true;

  if (s.grid.getLowestBubble() >= this.sizeH) {
    G.sb('gameOver').dispatch();
  }

};

G.GameGrid.prototype.moveAllBubblesDown = function(amount) {

  this.gridArray.clear();

  this.children.concat(this.nonCacheGroup.children).forEach(function(bubble) {
    bubble.cellY += amount;
    var insidePx = this.cellToInsidePx(bubble.cellX, bubble.cellY);
    bubble.x = insidePx[0];
    bubble.y = insidePx[1];
    bubble.orgX = insidePx[0];
    bubble.orgY = insidePx[1];
    bubble.collCircle.x = insidePx[0];
    bubble.collCircle.y = insidePx[1];

    this.gridArray.set(bubble.cellX, bubble.cellY, bubble);
  }, this);

  this.matchGroup.forEach(function(bubble) {
    G.stopTweens(bubble);
    bubble.cellY += amount;
    var insidePx = this.cellToInsidePx(bubble.cellX, bubble.cellY);
    bubble.x = bubble.orgX = insidePx[0];
    bubble.y = bubble.orgY = insidePx[1];
    bubble.collCircle.x = bubble.x;
    bubble.collCircle.y = bubble.y;
  }, this);

};

G.GameGrid.prototype.fillTopRows = function(rowsToRefill) {
  var colorsAvailable = this.getAllColorsOnBoard();
  for (var row = 0; row < rowsToRefill; row++) {
    for (var coll = 0, len = this.sizeW; coll < len; coll++) {
      this.makeBubble(coll, row, game.rnd.pick(colorsAvailable));
      if (row == 0) this.holds.push([coll, row]);
    }
  }
};
G.GameUI = function (desktop) {
  Phaser.Group.call(this, game);

  this.desktop = desktop;

  this.state = game.state.getCurrentState();

  // Best Score Counter
  this.bestScoreCounter = new G.BestScoreCounter(190, 30);
  this.add(this.bestScoreCounter);
  
  // Current Score Counter
  this.pointCounter = new G.PointCounter(490, 30);
  this.add(this.pointCounter);
  
  // Difficulty Level
  this.difficultyLabel = new G.DifficultyLabel(770, 30);
  this.add(this.difficultyLabel);
  
  // Setting Menu Button
  this.settingsMenuButton = this.addButton(920, 32, 'button_menue', '', function () {
    if (G.menuOpened) return;
    G.sfx.button_click.play();
    G.sb('pushWindow').dispatch('Menu');
  }, this);
  this.settingsMenuButton.scale.setTo(0.9);

  G.sb('onScreenResize').add(this.onResize, this);
  this.onResize();
};

G.GameUI.prototype = Object.create(Phaser.Group.prototype);

G.GameUI.prototype.onResize = function () {
  // this.y = game.world.bounds.y + game.height;
};

G.GameUI.prototype.addButton = function (x, y, sprite, text, func, context) {
  var button = new G.Button(x, y, sprite, func, context);
  button.addTextLabel('white_font', text, 40);
  this.add(button);
  return button;
};
G.GameUI_Mobile = function (mobile) {
  Phaser.Group.call(this, game);

  this.mobile = mobile;

  this.state = game.state.getCurrentState();

  this.bestScoreCounter = new G.BestScoreCounter(125, 40);
  this.add(this.bestScoreCounter);

  this.pointCounter = new G.PointCounter(350, 40);
  this.add(this.pointCounter);

  this.settingsMenuButton = this.addButton(585, 40, 'button_menue', '', function () {
    if (G.menuOpened) return;
    G.sfx.button_click.play();
    G.sb('pushWindow').dispatch('Menu');
  }, this);

  G.sb('onScreenResize').add(this.onResize, this);
  this.onResize();
};

G.GameUI_Mobile.prototype = Object.create(Phaser.Group.prototype);

G.GameUI_Mobile.prototype.onResize = function () {

    // this.y = game.world.bounds.y + 100;
    // this.Menu.x = 20;
    // this.bestScoreCounter.x = 215;
    // this.pointCounter.x = 436;
};

G.GameUI_Mobile.prototype.addButton = function (x, y, sprite, text, func, context) {
  var button = new G.Button(x, y, sprite, func, context);
  button.addTextLabel('white_font', text, 40);
  this.add(button);
  return button;
};
G.GridArray = function(minX, maxX, minY, maxY) {

  this.minX = minX || false;
  this.maxX = maxX || false;
  this.minY = minY || false;
  this.maxY = maxY || false;
  this.limited = this.minX || this.maxX || this.minY || this.maxY;

  this.mainArray = [];

  this.maxIndexX = false;
  this.minIndexX = false;
  this.maxIndexY = false;
  this.minIndexY = false;

}

G.GridArray.prototype.clear = function() {
  this.mainArray = [];
};


G.GridArray.prototype.set = function(x, y, value) {

  if (x.constructor === Array) {
    value = y;
    y = x[1];
    x = x[0];
  }

  if (this.limited && !this.inLinit(x, y)) {
    throw 'Out of limit!';
  }

  if (!this.mainArray[x]) {
    this.mainArray[x] = [];
  }

  this.mainArray[x][y] = value;

  this.setHelperValues(x, y);

  return value;

}

G.GridArray.prototype.get = function(x, y) {

  if (x.constructor === Array) {
    y = x[1];
    x = x[0];
  }


  if (this.limited && !this.inLimit(x, y)) {
    throw 'Out of limit!';
  }

  if (this.mainArray[x]) {
    if (this.mainArray[x][y]) {
      return this.mainArray[x][y];
    } else {
      return null;
    }
  } else {
    return null;
  }

}


G.GridArray.prototype.inLimit = function(x, y) {
  if (this.minX !== false && x < this.minX) return false;
  if (this.maxX !== false && x > this.maxX) return false;
  if (this.minY !== false && y < this.minY) return false;
  if (this.maxY !== false && y > this.maxY) return false;
  return true;
}

G.GridArray.prototype.setHelperValues = function(x, y) {
  if (this.maxIndexX === false) {
    this.maxIndexX = x;
    this.minIndexX = x;
    this.lengthX = 1;
    this.maxIndexY = y;
    this.minIndexY = y;
    this.lengthY = 1;
  } else {

    this.minIndexX = x < this.minIndexX ? x : this.minIndexX;
    this.maxIndexX = x > this.maxIndexX ? x : this.maxIndexX;
    this.minIndexY = y < this.minIndexY ? y : this.minIndexY;
    this.maxIndexY = y > this.maxIndexY ? y : this.maxIndexY;

  }

};
G.MobileButtonPanel = function(x, y) {

  Phaser.Group.call(this, game);

  this.x = game.width - G.l(70);
  this.y = y;

  G.menuOpened = false;

  this.menuBtn = new G.Button(0, 0, 'button_green', this.openCloseMenu, this);
  this.menuBtn.addTextLabel('Menu');
  this.add(this.menuBtn);

  this.openedGroup = game.add.group();
  this.openedGroup.visible = false;
  this.add(this.openedGroup);



  this.setupBtn = new G.Button(0, 0, 'button_turquoise', function() {
    this.openCloseMenu();
    game.state.getCurrentState().windowLayer.open('windowSetup');
  }, this);
  this.setupBtn.addTextLabel('Setup');

  this.restartBtn = new G.Button(-200, 0, 'button_green', () => {
    this.openCloseMenu();

    var state = game.state.getCurrentState();

    sdkHandler.trigger('gameOver', {
      score: state.pointCounter.score,
    }, this);
	  game.state.start("Game");
  }, this);        
	this.restartBtn.addTextLabel('Restart');

  this.helpBtn = new G.Button(0, -200, 'button_pink', function() {
    this.openCloseMenu();
    game.state.getCurrentState().windowLayer.open('windowHelp');

  }, this);
  this.helpBtn.addTextLabel('Help');

  this.openedGroup.addMultiple([this.setupBtn /*,this.top10Btn*/ , this.moreGamesBtn, this.restartBtn, this.helpBtn]);

  var distance = G.l(250);
  var angleStart = -180;
  var angleDiff = 23;

  this.openedGroup.children.forEach(function(elem, i) {
    elem.x = G.lengthDirX(angleStart + (angleDiff * i), distance, false);
    elem.y = G.lengthDirY(angleStart + (angleDiff * i), distance, false);
  });


  G.events.onWindowOpened.add(function() {
    this.menuBtn.inputEnabled = false;
    this.openedGroup.children.forEach(function(e) {
      e.inputEnabled = false;
    }, this)  
  }, this);
  G.events.onWindowClosed.add(function() {
    this.menuBtn.inputEnabled = true;
    this.openedGroup.children.forEach(function(e) {
      e.inputEnabled = true;
      e.input.useHandCursor = true;
	  }, this)
  }, this);
}

G.MobileButtonPanel.prototype = Object.create(Phaser.Group.prototype);

G.MobileButtonPanel.prototype.openCloseMenu = function() {
  this.openedGroup.visible = !this.openedGroup.visible;
  G.menuOpened = this.openedGroup.visible;
};
G.PointCounter = function(x, y) {
  Phaser.Group.call(this, game);
  this.position.setTo(x, y);
  
  this.bg = G.makeImage(0, 5, 'bg_numbers_hud', 0.5, this);
  this.bg.scale.setTo(0.8);
  this.score = 0;

  this.counterTxt = new G.OneLineText(0, -5, 'yellow_font', "0", 40, 180, 0.5, 0.5);
  this.add(this.counterTxt);

  G.sb('onAddPoints').add(function(amount) {
    if (G.gameOver) return;
    if (!amount) return;
    this.score += amount;
    this.counterTxt.setText(this.score.toString());
  }, this);
};

G.PointCounter.prototype = Object.create(Phaser.Group.prototype);
G.ScreenKeyboard = function(font, bgImg, width, height) {

  Phaser.Group.call(this, game);

  this.aeraWidth = width;
  this.aeraHeight = height;

  this.layout = [
  ['1234567890', {
    key: 'Backspace',
    label: 'backspace'
  }],
  ['qwertyuiop'],
  ['asdfghjkl'],
  ['zxcvbnm']
  ]

  this.stepY = Math.floor(this.aeraHeight / this.layout.length);

  this.font = font;
  this.bgImg = bgImg;

  this.init();

  this.onKeyDown = new Phaser.Signal();

  this.onResize();

};

G.ScreenKeyboard.prototype = Object.create(Phaser.Group.prototype);

G.ScreenKeyboard.prototype.onResize = function() {

  //this.x = game.world.bounds.x+game.width*0.5;
  //this.y = game.world.bounds.y+game.height-this.aeraHeight;

};

G.ScreenKeyboard.prototype.init = function() {

  this.layout.forEach(function(row, rowIndex) {

    this.processRow(row, rowIndex);

  }, this);

};

G.ScreenKeyboard.prototype.processRow = function(row, rowIndex) {
  var buttons = [];

  for (var i = 0; i < row.length; i++) {
    var elem = row[i];
    if (typeof elem == 'string') {
      for (var charIndex = 0; charIndex < elem.length; charIndex++) {
        var button = this.createButton(0, rowIndex * this.stepY, elem[charIndex]);
        this.add(button);
        buttons.push(button);
      }
    } else {
      var button = this.createButton(0, rowIndex * this.stepY, elem);
      this.add(button);
      buttons.push(button);
    }
  }
  this.spreadRow(buttons);

};

G.ScreenKeyboard.prototype.createButton = function(x, y, arg) {
  var key;
  var button = new G.Button(x, y, this.bgImg, function() {
    this.onKeyDown.dispatch({
      key: key
    });
  }, this);
  button.alphaOnPointer = false;
  button.IMMEDIATE = true;
  if (typeof arg == 'string') {
    key = arg;
    button.addTextLabel(this.font, arg, 40);
  } else {
    key = arg.key;
    button.label = G.makeImage(0, 0, arg.label, 0.5, button);
  }

  return button;

};

G.ScreenKeyboard.prototype.spreadRow = function(buttonList) {
  var buttonWidth = buttonList[0].width;
  var totalWidth = Math.min((buttonList.length - 1) * buttonWidth * 1.5, this.aeraWidth, game.width);
  var stepX = totalWidth / buttonList.length - 1;
  var startX = Math.floor(totalWidth * -0.5) + buttonWidth * 0.75;

  buttonList.forEach(function(key) {
    key.x = startX;
    startX += stepX;
  }, this);

};
G.Shooter = function (x, y, grid, config) {
  Phaser.Group.call(this, game);

  this.grid = grid;
  this.state = game.state.getCurrentState();
  this.shooterMargin = G.l(70);

  this.x = config.x;
  this.y = config.y;

  this.pointer = G.makeImage(0, 0, 'arrow', [0.5, (178 - (59 * 0.5)) / 178], this);
  this.pointer.alpha = 1;

  if (game.device.desktop) {
    game.input.onDown.add(this.onInputDown, this);
  } else {
    game.input.onUp.add(this.onInputDown, this);
  }

  this.flyingBubbles = game.add.group();
  for (var i = 0; i < 5; i++) {
    this.flyingBubbles.add(new G.BubbleFlying(this.grid));
  }

  this.chances = config.chances;
  this.chancesOrg = config.chances;
  this.chancesIndex = 0;
  this.chancesArray = [6, 5, 5, 4, 4, 3, 3]
  this.chancesCurrent = config.chances;

  var offsetX = 38;
  var chances = 5;
  if (game.device.desktop) {
    var startX = (chances * 148) * -0.5;
  } else {
    var startX = (chances * 100) * -0.5;
  }

  this.chancesImg = [];

  for (var i = 0; i < config.chances + 1; i++) {
    var emptyBubble = G.makeImage(startX + (i * offsetX), 10, 'bubble_grey', 0.5, this);
    emptyBubble.scale.setTo(0.75);
    this.chancesImg.push(emptyBubble);
  }

  this.nextBubble = G.makeImage(startX, 10, 'bubble_' + game.rnd.pick(G.bubbleNames), 0.5, this);
  this.nextBubble.scale.setTo(0.75);
  this.currentBubble = G.makeImage(0, 0, 'bubble_' + game.rnd.pick(G.bubbleNames), 0.5, this);

  this.ready = true;

  G.sb('onMoveDone').add(this.onMoveDoneNew, this);

  G.sb('gameOver').add(function () {
    this.gameOver = true;
  }, this);

  G.sb('onWindowOpened').add(function () {
    this.windowOpened = true;
  }, this);
  G.sb('onAllWindowsClosed').add(function () {
    this.windowOpened = false;
  }, this);

  this.vLCur = config.chances;
  this.max_lives = config.chances;
  this.chancesInit = config.chances;
};

G.Shooter.prototype = Object.create(Phaser.Group.prototype);

G.Shooter.prototype.update = function () {
  if (this.gameOver || G.menuOpened) return;
  if (this.isPointerOverField() && !this.windowOpened) {
    this.pointer.angle = game.math.radToDeg(game.math.angleBetween(this.x, this.y, this.activePointer.worldX, this.activePointer.worldY)) + 90;
  }
};

G.Shooter.prototype.isPointerOverField = function (pointer) {
  this.activePointer = pointer || game.input.activePointer;
  return this.grid.gridFiledRect.contains(this.activePointer.worldX, this.activePointer.worldY)
};

G.Shooter.prototype.isReadyToShoot = function () {
  return !G.menuOpened && this.currentBubble.scale.x == 1 && this.ready && !this.gameOver && !this.windowOpened;
};


G.Shooter.prototype.onInputDown = function () {
  if (game.paused) return;

  if (this.isPointerOverField() && this.isReadyToShoot()) {
    var index = G.bubbleNames.indexOf(this.currentBubble.frameName.slice(7));
    var bubble = this.flyingBubbles.getFirstDead();
    this.pointer.angle = game.math.radToDeg(game.math.angleBetween(this.x, this.y, this.activePointer.worldX, this.activePointer.worldY)) + 90;
    bubble.init(this.x, this.y, this.pointer.angle - 90, index);

    this.currentBubble.scale.setTo(0);

    this.ready = false;

    G.sfx.shoot_bubble.play();
  }

};

G.Shooter.prototype.onMoveDone = function (success) {
  if (this.grid.getAllColorsOnBoard().length == 0) return;

  if (!success) {
    this.chancesCurrent--;
    if (this.chancesCurrent == 0) {
      this.chances--;

      if (this.chances == 0) {
        var chancesIndexRefill = Math.min(this.chancesIndex, this.chancesArray.length - 1);
        this.chances = this.chancesArray[chancesIndexRefill];
        this.chancesIndex++;
      }

      this.grid.makeRefill();
      this.chancesCurrent = this.chances;

      this.chancesImg.forEach(function (elem, index) {
        if (index < this.chances) {

          var size = game.device.desktop ? 1 : 0.
          game.add.tween(elem.scale).to({
            x: 1,
            y: 1
          }, 200, Phaser.Easing.Linear.None, true);
        }
      }, this);
    } else {
      game.add.tween(this.chancesImg[this.chancesCurrent].scale).to({
        x: 0,
        y: 0
      }, 200, Phaser.Easing.Linear.None, true);
    }
  }

  if (!this.gameOver) {
    this.getNextBubble();
  }
};

G.Shooter.prototype.onMoveDoneNew = function (success) {
  if (!success) {

    if (this.vLCur > 0) {
      this.vLCur--;
      game.add.tween(this.chancesImg[this.vLCur + 1].scale).to({
        x: 0,
        y: 0
      }, 200, Phaser.Easing.Linear.None, true);
    } else {
      var level_max_lives = this.chancesInit;

      var available_colors = this.state.grid.getAllColorsOnBoard();
      var num_available_colors = available_colors.length;

      if (this.max_lives > 0) {
        this.max_lives--;
      } else {
        this.max_lives = level_max_lives;
      }

      num_available_colors = 6 - num_available_colors;
      this.max_lives = game.math.clamp(this.max_lives, 0, level_max_lives - num_available_colors);
      this.vLCur = this.max_lives;

      for (var i = 0; i <= this.max_lives; i++) {
        game.add.tween(this.chancesImg[i].scale).to({
          x: 0.75,
          y: 0.75
        }, 200, Phaser.Easing.Linear.None, true);
      }
      for (var i = this.max_lives + 1; i <= this.max_lives; i++) {
        game.add.tween(this.chancesImg[i].scale).to({
          x: 0,
          y: 0
        }, 200, Phaser.Easing.Linear.None, true); // hide lost lives
      }

      this.grid.makeRefill();
    }

  }

  if (!this.gameOver) {
    this.getNextBubble();
  }

};

G.Shooter.prototype.getNextBubble = function () {

  var colorsAvailable = this.grid.getAllColorsOnBoard();

  if (colorsAvailable.length == 0) return;

  G.stopTweens(this.currentBubble);
  G.stopTweens(this.nextBubble);

  this.currentBubble.frameName = this.nextBubble.frameName;
  game.add.tween(this.currentBubble.scale).to({
    x: 1,
    y: 1
  }, 200, Phaser.Easing.Linear.None, true);
  game.add.tween(this.nextBubble.scale).to({
    x: 0,
    y: 0
  }, 200, Phaser.Easing.Linear.None, true).onComplete.add(function () {

    G.changeTexture(this.nextBubble, 'bubble_' + G.bubbleNames[game.rnd.pick(colorsAvailable)]);
    game.add.tween(this.nextBubble.scale).to({
      x: 0.75,
      y: 0.75
    }, 200, Phaser.Easing.Linear.None, true).onComplete.add(function () {
      this.ready = true;
    }, this)

  }, this)

};
G.Window = function (type) {
  Phaser.Group.call(this, game);
  this.state = game.state.getCurrentState();
  G.overlayImage.visible = true;
  this.bg = G.makeImage(0, 0, "settings_menue", 0.5, this);
  switch (type) {
    case "Menu":
      this.bg.scale.x = 0.77;
      break;
    case "Settings":
      this.bg.scale.y = 0.77;
      break;
    case "Restart":
    case "Reset_data":
      this.bg.scale.setTo(0.8);
      break;
    default:
      break;
  }

  if (typeof type == "object") {
    switch (type[0]) {
      case "Stats":
        this.bg.scale.x = 0.95;
        this.bg.scale.y = 0.9;
        break;
      case "gameOver":
        this.bg.scale.x = 0.95;
        this.bg.scale.y = 0.85;
        break;
      default:
        break;
    }
  }

  this.add(this.bg);

  this.gfx = game.add.graphics();
  this.add(this.gfx);

  if (type.constructor === Array) {
    this[type[0]].apply(this, type.slice(1));
  } else {
    this[type].apply(this, Array.prototype.slice.call(arguments, 1));
  }

  G.sb('onWindowOpened').dispatch(this);
};

G.Window.prototype = Object.create(Phaser.Group.prototype);

G.Window.prototype.closeWindow = function () {
  G.overlayImage.visible = false;
  G.sfx.button_click.play();
  G.sb('onWindowClosed').dispatch();
  this.destroy();
};

G.Window.prototype.drawWindow = function (width, height) {
  width = G.l(width) || this.currentWindowWidth;
  height = G.l(height) || this.currentWindowHeight;

  this.gfx.clear();
  this.currentWindowWidth = width;
  this.currentWindowHeight = height;
};

G.Window.prototype.addTitle = function (x = 0, y = -180, text, size = 40) {
  this.title = new G.OneLineText(x, y, 'button_font', text, size, 480, 0.5, 0.5);
  this.add(this.title);
};

G.Window.prototype.addButton = function (x, y, sprite, text, func, context) {
  var button = new G.Button(x, y, sprite, func, context);
  button.addTextLabel('button_font', text, 40);
  this.add(button);
  return button;
};

G.Window.prototype.addAllPopupButton = function (x, y, sprite, text, func, context) {
  var button = new G.Button(x, y, sprite, func, context);
  button.addTextLabel('button_font', text, 30);
  button.scale.setTo(0.8);
  this.add(button);
  return button;
};

G.Window.prototype.addLabelButton = function (x, y, label, labelWidth, sprite) {
  var group = game.make.group();
  group.position.setTo(x, y);
  group.button = new G.Button(0, 0, sprite || 'checkmark_select');
  group.add(group.button);
  group.label = new G.OneLineText(20, -5, 'button_font', label, 28, labelWidth, 0, 0.5);
  group.add(group.label);
  this.add(group);
  return group;
};

G.Window.prototype.addSoundLabelButton = function (x, y, label, labelWidth, sprite) {
  var group = game.make.group();
  group.position.setTo(x, y);
  group.button = new G.Button(0, 0, sprite || 'checkmark_select');
  group.add(group.button);
  group.label = new G.OneLineText(-5, -12, 'button_font', label, 25, labelWidth, 0.5, 0.5);
  group.add(group.label);
  this.add(group);
  return group;
};

G.Window.prototype.addLabel = function (x, y, txt, labelWidth) {
  var label = new G.OneLineText(x, y, 'button_font', txt, 25, labelWidth || 400, 0.5, 0.5);
  this.add(label);
  return label;
};
G.Window.prototype.leaderboard = function(index) {
  if (typeof gameLevel === 'undefined') gameLevel = G.gameLevel;
  this.addTitle(G.txt(3));

  var data = G.saveStateData.top10[G.gameLevel].slice(0, 10);
  this.entries = [];
  for (var i = 0; i < 10; i++) {
    var entry = data[i] || ['---', '---'];
    this.entries.push(this.leaderboardMakeEntry(0, -220 + (i * 45), i + 1, entry, index === i));
  }
  this.addMultiple(this.entries);

  this.btn = this.addButton(0, 280, 'button_big', G.gameOver ? G.txt(13) : G.txt(14), function() {
    if (G.gameOver) {      
      sdkHandler.trigger('gameOver', { 
        score: G.points
      });
      game.state.start('Game');
    } else {
      this.closeWindow();
    }
  }, this);
};

G.Window.prototype.leaderboardMakeEntry = function(x, y, nr, entry, big) {
  var group = game.make.group();
  group.y = y;

  var name = entry[0];
  var points = entry[1];

  group.bg = G.makeImage(0, 0, big ? 'bg_numbers_middle' : 'bg_numbers_small', 0.5, group);
  group.nrTxt = new G.OneLineText(big ? -202 : -190, 0, 'font', nr, 25, 400, 0.5, 0.5);
  group.add(group.nrTxt);

  group.nameTxt = new G.OneLineText(big ? -155 : -120, 0, 'font', name, 25, 170, 0, 0.5);
  group.add(group.nameTxt);

  group.pointsTxt = new G.OneLineText(157, 0, 'font', points, 25, 200, 0.5, 0.5);
  group.add(group.pointsTxt);

  if (big) {
    group.nrTxt.tint = 0xffcc00;
    group.nrTxt.updateCache();
    group.nameTxt.tint = 0xffcc00;
    group.nameTxt.updateCache();
    group.pointsTxt.tint = 0xffcc00;
    group.pointsTxt.updateCache();
  }

  return group;
}
G.Window.prototype.Menu = function (x, y, desktop) {
  this.addTitle(0, -235, G.txt(20), 45);
  // Phaser.Group.call(this, game);
  // this.position.setTo(x, y);
  // this.game_sound_mute = game.sound.mute;

  this.state = game.state.getCurrentState();

  this.buttons = [

    // Stats Button
    this.addButton(0, -115, 'button_small', G.txt(26), function () {
      this.closeWindow();
      G.sb('pushWindow').dispatch(['Stats', G.gameLevel]);
    }, this),

    // Difficulty Button
    this.addDifficultyButton(0, -10, 'button_small', G.txt(40), function () {
      this.closeWindow();
      G.sb('pushWindow').dispatch('Settings');
    }, this),

    // Restart Button
    this.addButton(0, 200, 'button_small', G.txt(0), function () {
      this.closeWindow();
      G.sb('pushWindow').dispatch('Restart');
    }, this)
  ];

  // Sound Button
  this.soundBtn = this.addSoundLabelButton(0, 95, G.txt(12), 160);
  G.changeTexture(this.soundBtn.button, game.sound.mute ? 'button_red' : 'button_small');
  this.soundBtn.button.onClick.add(function () {
    game.sound.mute = !game.sound.mute;
    G.changeTexture(this, game.sound.mute ? 'button_red' : 'button_small');
    G.saveStateData.mute = game.sound.mute;
    G.sfx.button_click.play();
    G.save();
  }, this.soundBtn.button);
  this.soundBtn.scale.y = 0.9;

  this.buttons.forEach(element => {
    element.scale.y = 0.9;
  });

  // Close Settings Button
  this.closeSettingsBtn = this.addButton(180, -225, 'button_close', '', function () {
    this.closeWindow();
  }, this);
  this.closeSettingsBtn.scale.setTo(0.8);
  // Close Settings Button
};

G.Window.prototype.addButton = function (x, y, sprite, text, func, context) {
  var button = new G.Button(x, y, sprite, func, context);
  button.addTextLabel('button_font', text, 25);
  this.add(button);
  return button;
};

G.Window.prototype.addDifficultyButton = function (x, y, sprite, text, func, context) {
  var button = new G.Button(x, y, sprite, func, context);
  button.addTextLabelonMenuButton('button_font', text, 25);
  this.add(button);
  return button;
};
G.Window.prototype.Reset_data = function () {
  this.addTitle(0, -190, G.txt(35), 35);
  this.bg = G.makeImage(-217, -110, 'window_dark_bg_H', 0, this);
  this.bg.scale.setTo(0.8);

  this.areYouSureTxt = new G.MultiLineText(0, -50, 'button_font', G.txt(28), 40, 440, 255, 'center', 0.5, 0, 0x9F3777);
  this.areYouSureTxt.updateCache();
  this.add(this.areYouSureTxt);

  // Reset Stats popup Reset Button
  this.resetBtn = this.addAllPopupButton(-120, 145, 'button_red', G.txt(31), function () {
    G.sfx.button_click.play();
    for (let i = 0; i < 3; ++i) {
      G.bestScore[i] = 0;
      G.previousScore[i] = 0;
    }
    G.save();
    G.BestScoreCounter.prototype.ResetCounter();
    this.closeWindow();
  }, this);
  // Reset Stats popup Reset Button

  // Reset Stats popup Cancel Button
  this.cancelButton = this.addAllPopupButton(120, 145, 'button_small', G.txt(6), function () {
    this.closeWindow();
  }, this);
  // Reset Stats popup Cancel Button
};
G.Window.prototype.Restart = function () {
  this.addTitle(0, -190, G.txt(0), 40);
  this.bg = G.makeImage(-217, -110, 'window_dark_bg_H', 0, this);
  this.bg.scale.setTo(0.8);

  this.areYouSureTxt = new G.MultiLineText(0, -50, 'button_font', G.txt(28), 40, 440, 255, 'center', 0.5, 0, 0x9F3777);
  this.areYouSureTxt.updateCache();
  this.add(this.areYouSureTxt);

  // Restart Popup Ok Button
  this.okBtn = this.addAllPopupButton(-120, 145, 'button_small', G.txt(5), function () {
    sdkHandler.trigger('gameOver', {
      score: this.state.ui.pointCounter.score,
    })

    sdkHandler.trigger('beforePlayButtonDisplay', {
      callback: () => {
        game.state.start("Game");
        sdkHandler.trigger('gameStart');
      }
    }, this);
    this.closeWindow();
  }, this);
  // Restart Popup Ok Button

  // Restart Popup Cancel Button
  this.cancelButton = this.addAllPopupButton(120, 145, 'button_small', G.txt(6), function () {
    this.closeWindow();
  }, this);
  // Restart Popup Cancel Button
};
G.Window.prototype.Settings = function () {
  this.addTitle(0, -180, G.txt(40), 40);
  this.gameLevel = G.gameLevel;
  // this.pointerArrow = G.pointerArrow;
  // this.game_sound_mute = game.sound.mute;

  // Difficulty Level change option
  this.levelsButton = [
    this.addLabelButton(-240, -40, G.txt(9), 140),
    this.addLabelButton(-60, -40, G.txt(10), 140),
    this.addLabelButton(120, -40, G.txt(11), 140)
  ];
  this.setupRefreshLevelButtons();

  this.levelsButton.forEach(function (btnLabel, index) {
    btnLabel.button.onClick.add(function () {
      G.sfx.button_click.play();
      G.gameLevel = index;
      this.parent.parent.setupRefreshLevelButtons();
    }, btnLabel.button);
  });

  this.levelsButton[1].inputEnabled = false;
  this.levelsButton[2].inputEnabled = false;
  // Difficulty Level change option

  // Pointer/Arrow Option
  // this.pointerArrowButton = [
  //   this.addLabelButton(-220, -30, G.txt(29), 160),
  //   this.addLabelButton(-60, -30, G.txt(30), 160),
  // ];
  // this.setupRefreshPointerArrowButtons();

  // this.pointerArrowButton.forEach(function (btnLabel, index) {
  //   btnLabel.button.onClick.add(function () {
  //     G.sfx.button_click.play();
  //     G.pointerArrow = index;

  //     this.parent.parent.setupRefreshPointerArrowButtons();
  //   }, btnLabel.button);
  // });

  // this.pointerArrowButton[1].inputEnabled = false;
  // Pointer/Arrow Option

  // Sound Button
  // this.soundBtn = this.addLabelButton(-240, 30, G.txt(12), 160);
  // G.changeTexture(this.soundBtn.button, game.sound.mute ? 'checkmark_unselect' : 'checkmark_select');

  // this.soundBtn.button.onClick.add(function () {
  //   game.sound.mute = !game.sound.mute;
  //   G.changeTexture(this, game.sound.mute ? 'checkmark_unselect' : 'checkmark_select');
  // }, this.soundBtn.button);
  // Sound Button

  // Okay Button
  this.okBtn = this.addAllPopupButton(-140, 130, 'button_small', G.txt(5), function () {
    G.saveStateData.gameLevel = G.statsGameLevel = G.gameLevel;
    // G.saveStateData.pointerArrow = G.pointerArrow;
    // G.saveStateData.mute = game.sound.mute;
    G.save();
    let state = game.state.getCurrentState();

    if (this.gameLevel != G.gameLevel) {
      sdkHandler.trigger('gameOver', {
        score: state.ui.pointCounter.score
      }, this);

      sdkHandler.trigger('beforePlayButtonDisplay', {
        callback: () => {
          game.state.start("Game");
          sdkHandler.trigger('gameStart');
        }
      }, this);
    }
    this.closeWindow();
  }, this);
  // Okay Button

  // Cancel Button
  this.cancelButton = this.addAllPopupButton(140, 130, 'button_small', G.txt(6), function () {
    G.gameLevel = this.gameLevel;
    // G.pointerArrow = this.pointerArrow;
    // game.sound.mute = this.game_sound_mute;
    G.save();
    this.closeWindow();
  }, this);
  // Cancel Button
};

G.Window.prototype.setupRefreshLevelButtons = function () {
  this.levelsButton.forEach(function (e, index) {
    e.gameLevel = index;
    if (e.gameLevel == G.gameLevel) {
      G.changeTexture(e.button, 'checkmark_select');
    } else {
      G.changeTexture(e.button, 'checkmark_unselect')
    }
  }, this);
}

// G.Window.prototype.setupRefreshPointerArrowButtons = function () {
//   this.pointerArrowButton.forEach(function (e, index) {
//     e.pointerArrow = index;
//     if (e.pointerArrow == G.pointerArrow) {
//       G.changeTexture(e.button, 'checkmark_select');
//     } else {
//       G.changeTexture(e.button, 'checkmark_unselect')
//     }
//   }, this);
// }

G.Window.prototype.Stats = function (gameLevelIndex) {
  this.addTitle(0, -210, G.txt(26), 45);
  this.bg = G.makeImage(-270, -105, 'window_dark_bg_H', 0, this);
  this.bg.scale.y = 0.92;
  this.getDifficultyLevel(gameLevelIndex);

  // Difficulty Level
  this.difficultyLevelsButton = [
    this.addTabButton(-158, -110, G.txt(9), 160, 'tab_active'),
    this.addTabButton(3, -110, G.txt(10), 160, 'tab_active'),
    this.addTabButton(163, -110, G.txt(11), 160, 'tab_active')
  ];
  this.refreshDifficultyLevelButtons();

  this.difficultyLevelsButton.forEach(function (btnLabel, index) {
    btnLabel.button.onClick.add(function () {
      G.sfx.button_click.play();
      G.statsGameLevel = index;
      this.parent.parent.refreshDifficultyLevelButtons();
      this.parent.parent.closeWindow();
      G.sb('pushWindow').dispatch(['Stats', index]);
    }, btnLabel.button);
  });
  // Difficulty Level


  let initial_Y = -55;

  // Best Score
  // this.bestScoreTxt = new G.OneLineText(-230, -75, 'button_font', G.txt(32), 30, 250, 0, 0.5);
  this.bestScoreTxt = new G.OneLineText(-230, initial_Y, 'button_font', G.txt(32), 30, 250, 0, 0.5);
  this.bestScoreTxt.updateCache();
  this.add(this.bestScoreTxt);

  // this.trophy_goldIcon = G.makeImage(15, -65, 'trophy_gold', 0.5, this);
  this.trophy_goldIcon = G.makeImage(15, initial_Y + 10, 'trophy_gold', 0.5, this);
  this.trophy_goldIcon.scale.setTo(0.7);
  this.add(this.trophy_goldIcon);

  // this.bestScore = new G.OneLineText(240, -75, 'button_font', G.bestScore[G.statsGameLevel].toString(), 30, 150, 1, 0.5);
  this.bestScore = new G.OneLineText(240, initial_Y, 'button_font', G.bestScore[G.statsGameLevel].toString(), 30, 150, 1, 0.5);
  this.bestScore.updateCache();
  this.add(this.bestScore);
  // Best Score

  if (gameLevelIndex == G.gameLevel) {
    // Current Score
    initial_Y += 60;
    // this.currentScoreTxt = new G.OneLineText(-230, -5, 'button_font', G.txt(33), 30, 250, 0, 0.5);
    this.currentScoreTxt = new G.OneLineText(-230, initial_Y, 'button_font', G.txt(33), 30, 250, 0, 0.5);
    this.currentScoreTxt.updateCache();
    this.add(this.currentScoreTxt);

    // this.trophy_currentIcon = G.makeImage(15, 5, 'trophy_current', 0.5, this);
    this.trophy_currentIcon = G.makeImage(15, initial_Y + 10, 'trophy_current', 0.5, this);
    this.trophy_currentIcon.scale.setTo(0.7);
    this.add(this.trophy_currentIcon);

    // this.currentScore = new G.OneLineText(240, -5, 'button_font', this.state.ui.pointCounter.score.toString(), 30, 150, 1, 0.5);
    this.currentScore = new G.OneLineText(240, initial_Y, 'button_font', this.state.ui.pointCounter.score.toString(), 30, 150, 1, 0.5);
    this.currentScore.updateCache();
    this.add(this.currentScore);
    // Current Score
  }

  // Previous Score
  initial_Y += 60;
  // this.previousScoreTxt = new G.OneLineText(-230, 65, 'button_font', G.txt(34), 30, 250, 0, 0.5);
  this.previousScoreTxt = new G.OneLineText(-230, initial_Y, 'button_font', G.txt(34), 30, 250, 0, 0.5);
  this.previousScoreTxt.updateCache();
  this.add(this.previousScoreTxt);

  // this.trophy_previousIcon = G.makeImage(15, 75, 'trophy_previous', 0.5, this);
  this.trophy_previousIcon = G.makeImage(15, initial_Y + 10, 'trophy_previous', 0.5, this);
  this.trophy_previousIcon.scale.setTo(0.7);
  this.add(this.trophy_previousIcon);

  // this.previousScore = new G.OneLineText(240, 65, 'button_font', G.previousScore[G.statsGameLevel].toString(), 30, 150, 1, 0.5);
  this.previousScore = new G.OneLineText(240, initial_Y, 'button_font', G.previousScore[G.statsGameLevel].toString(), 30, 150, 1, 0.5);
  this.previousScore.updateCache();
  this.add(this.previousScore);
  // Previous Score

  // Reset Button
  this.resetBtn = this.addAllPopupButton(-140, 175, 'button_small', G.txt(31), function () {
    G.statsGameLevel = G.gameLevel;
    this.getDifficultyLevel(G.gameLevel);
    this.closeWindow();
    G.sb('pushWindow').dispatch('Reset_data');
  }, this);
  // Reset Button

  // OK Button
  this.okButton = this.addAllPopupButton(140, 175, 'button_small', G.txt(5), function () {
    G.statsGameLevel = G.gameLevel;
    this.getDifficultyLevel(G.gameLevel);
    this.closeWindow();
  }, this);
  // OK Button
};

G.Window.prototype.addTabButton = function (x, y, label, labelWidth, sprite) {
  var group = game.make.group();
  group.position.setTo(x, y);
  group.button = new G.Button(0, 0, sprite || 'tab_active');
  group.button.scale.x = 0.78;
  group.button.scale.y = 0.8;
  group.add(group.button);
  group.label = new G.OneLineText(0, -5, 'yellow_font', label, 28, labelWidth, 0.5, 0.5);
  group.add(group.label);
  this.add(group);
  return group;
};


G.Window.prototype.refreshDifficultyLevelButtons = function () {
  this.difficultyLevelsButton.forEach(function (e, index) {
    e.gameLevel = index;
    if (e.gameLevel == G.statsGameLevel) {
      G.changeTexture(e.button, 'tab_active');
    } else {
      G.changeTexture(e.button, 'tab_inactive')
    }
  }, this);
}

G.Window.prototype.getDifficultyLevel = function (level) {
  G.statsGameLevel = level;
}
G.Window.prototype.enterYourNickname = function(init) {
  this.addTitle(G.txt(25));

  this.inputField = {
    value: 'hate'
  };

  this.inputText = new G.OneLineText(0, -4, 'font', ' ', 40, 300, 0.5, 0.5);
  this.inputText.setText('');
  this.add(this.inputText);

  this.cursorTxt = new G.OneLineText(0, -4, 'font', '|', 40, 300, 0, 0.5);
  this.add(this.cursorTxt);
  this.cursorTxt.inputText = this.inputText;
  this.cursorTxt.frameCounter = 0;
  this.cursorTxt.update = function() {
    this.x = this.inputText.x + this.inputText.width * 0.5;
    this.frameCounter = ++this.frameCounter % 60;
    this.visible = this.frameCounter < 30;
  };

  this.inputRegEx = new RegExp('[a-zA-Z0-9.-_ ]');

  if (init) {
    this.okBtn = this.addButton(0, 280, 'button_big', G.txt(5), this.nicknameAccept, this);
  } else {
    this.okBtn = this.addButton(90, 280, 'button_middle', G.txt(5), this.nicknameAccept, this);
    this.cancelBtn = this.addButton(-150, 280, 'button_small', G.txt(6), function() {
      this.closeWindow();
    }, this);
  }

  if (game.device.desktop) {
    game.input.keyboard.onDownCallback = (this.onDownKeyboardCallback).bind(this);
  } else {
    this.okBtn.y = 0;
    if (this.cancelBtn) this.cancelBtn.y = 0;
    this.cursorTxt.y = -140
    this.inputText.y = -140;
    this.screenKeyboard = new G.ScreenKeyboard('font', 'keyboard', 500, 280);
    this.add(this.screenKeyboard);
    this.screenKeyboard.y = 80
    this.screenKeyboard.onKeyDown.add(this.onDownKeyboardCallback, this);
    this.binding = G.sb('onScreenResize').add(this.screenKeyboard.onResize, this.screenKeyboard);
  }

};

G.Window.prototype.pushToTop10 = function(name, score) {
  var newEntry = [name, score];
  G.saveStateData.top10[G.gameLevel].push(newEntry);
  G.saveStateData.top10[G.gameLevel].sort(function(a, b) {
    return b[1] - a[1]
  });
  G.saveStateData.top10[G.gameLevel] = G.saveStateData.top10[G.gameLevel].splice(0, 10);
  G.save();

  return G.saveStateData.top10[G.gameLevel].indexOf(newEntry);
}

G.Window.prototype.onDownKeyboardCallback = function(event) {
  if (event.key == 'Backspace') {
    this.inputText.setText(this.inputText.text.slice(0, Math.max(0, this.inputText.text.length - 1)));
    this.cursorTxt.frameCounter = 0;
  } else if (event.key == 'Enter') {
    this.nicknameAccept();
  } else if (this.inputText.text.length < 10 && event.key.length == 1 && this.inputRegEx.test(event.key)) {
    this.inputText.setText(this.inputText.text + event.key);
    this.cursorTxt.frameCounter = 0;
  }

  return false;
};

G.Window.prototype.nicknameAccept = function() {
  if (G.saveStateData.nickname === '' && this.inputText.text.length == 0) {
    G.saveStateData.nickname = 'Player';
    G.save();
    this.closeWindow();
    return;
  };

  if (this.inputText.text.length == 0) return;

  if (this.screenKeyboard) this.screenKeyboard.destroy();
  game.input.keyboard.onDownCallback = null;
  if (this.binding) this.binding.detach();

  G.saveStateData.nickname = this.inputText.text;
  G.save();
  this.closeWindow();
};
G.Window.prototype.gameOver = function (bonusScore) {
  this.addTitle(0, -200, G.txt(16), 40);
  this.bg1 = G.makeImage(-275, -135, 'window_dark_bg_H', 0, this);
  this.bg1.scale.y = 0.95;
  let won = this.state.grid.children.length == 0;
  let points = this.state.ui.pointCounter.score;
  let bonus = bonusScore ? this.state.ui.pointCounter.score : 0;
  G.points = points + bonus;
  G.saveStateData.previousScore[G.gameLevel] = this.state.ui.pointCounter.score;
  if (this.state.ui.pointCounter.score > G.bestScore[G.gameLevel]) {
    G.saveStateData.bestScore[G.gameLevel] = this.state.ui.pointCounter.score;
  }
  G.save();
  G.bestScore[G.gameLevel] = G.saveStateData.bestScore[G.gameLevel];
  G.previousScore[G.gameLevel] = G.saveStateData.previousScore[G.gameLevel];

  if (won) {
    G.sfx.won.play();
  } else {
    G.sfx.lost.play();
  }

  let difficultyLevelString = "";
  switch (G.gameLevel) {
    case 0:
      difficultyLevelString = G.txt(9);
      break;
    case 1:
      difficultyLevelString = G.txt(10);
      break;
    case 2:
      difficultyLevelString = G.txt(11);
      break;
    default:
      break;
  }
  // Difficulty Level
  this.bestScoreTxt = new G.OneLineText(-250, -110, 'button_font', G.txt(40), 25, 250, 0, 0.5);
  this.bestScoreTxt.updateCache();
  this.add(this.bestScoreTxt);

  this.trophy_goldIcon = G.makeImage(50, -100, 'trophy_difficulty', 0.5, this);
  this.trophy_goldIcon.scale.setTo(0.7);
  this.add(this.trophy_goldIcon);

  this.bestScore = new G.OneLineText(240, -110, 'button_font', difficultyLevelString, 25, 150, 1, 0.5);
  this.bestScore.updateCache();
  this.add(this.bestScore);
  // Difficulty Level

  // Best Score
  this.bestScoreTxt = new G.OneLineText(-250, -60, 'button_font', G.txt(38), 25, 250, 0, 0.5);
  this.bestScoreTxt.updateCache();
  this.add(this.bestScoreTxt);

  this.trophy_goldIcon = G.makeImage(50, -50, 'trophy_gold', 0.5, this);
  this.trophy_goldIcon.scale.setTo(0.7);
  this.add(this.trophy_goldIcon);

  this.bestScore = new G.OneLineText(240, -60, 'button_font', G.bestScore[G.gameLevel].toString(), 25, 150, 1, 0.5);
  this.bestScore.updateCache();
  this.add(this.bestScore);
  // Best Score

  // Current Score
  this.currentScoreTxt = new G.OneLineText(-250, -10, 'button_font', G.txt(39), 25, 250, 0, 0.5);
  this.currentScoreTxt.updateCache();
  this.add(this.currentScoreTxt);

  this.trophy_currentIcon = G.makeImage(50, 0, 'trophy_current', 0.5, this); 
  this.trophy_currentIcon.scale.setTo(0.7);
  this.add(this.trophy_currentIcon);

  this.currentScore = new G.OneLineText(240, -10, 'button_font', this.state.ui.pointCounter.score.toString(), 25, 150, 1, 0.5);
  this.currentScore.updateCache();
  this.add(this.currentScore);
  // Current Score

  // Popped
  this.poppedTxt = new G.OneLineText(-250, 40, 'button_font', G.txt(36), 25, 250, 0, 0.5);
  this.poppedTxt.updateCache();
  this.add(this.poppedTxt);

  this.trophy_poppedIcon = G.makeImage(50, 50, 'trophy_popped', 0.5, this);
  this.trophy_poppedIcon.scale.setTo(0.7);
  this.add(this.trophy_poppedIcon);

  this.popped = new G.OneLineText(240, 40, 'button_font', G.bubblesPopped.toString(), 25, 150, 1, 0.5);
  this.popped.updateCache();
  this.add(this.popped);
  // Popped

  // Play Again Button
  this.playAgainBtn = this.addPlayAgainButton(-10, 155, 'button_small', G.txt(37), function () {
    sdkHandler.trigger('beforePlayButtonDisplay', {
      callback: () => {
        game.state.start('Game');
        sdkHandler.trigger('gameStart');
        this.closeWindow();
      }
    }, this)
  }, this);
  this.playAgainBtn.scale.x = 1.2;

  // this.playAgainBtn.visible = false;
  // sdkHandler.trigger('beforePlayButtonDisplay', {
  //   callback: () => {
  //     this.playAgainBtn.visible = true;
  //   }
  // }, this)
  // Play Again Button
};

G.Window.prototype.addPlayAgainButton = function (x, y, sprite, text, func, context) {
  var button = new G.Button(x, y, sprite, func, context);
  button.addTextLabelGameOver('button_font', text, 30);
  this.add(button);
  return button;
};
G.Window.prototype.help = function() {
  this.addTitle(G.txt(1));
  this.btn = this.addButton(0, 280, 'button_big', G.txt(14), this.closeWindow, this);
  this.helpTxt = new G.MultiLineText(0, -230, 'font', G.txt(22), 20, 480, 500, 'left', 0.5, 0);
  this.helpTxt.updateCache();
  this.add(this.helpTxt);
};
G.WindowLayer = function() {
  Phaser.Group.call(this, game);
  this.fixedToCamera = true;

  this.state = game.state.getCurrentState();

  this.queue = [];

  G.sb('pushWindow').add(this.pushWindow, this);
  G.sb('onWindowClosed').add(this.onWindowClosed, this);
  G.sb('onWindowOpened').add(this.cacheWindow, this);
  G.sb('onScreenResize').add(this.onResize, this);
};

G.WindowLayer.prototype = Object.create(Phaser.Group.prototype);

G.WindowLayer.prototype.onResize = function() {
  this.cameraOffset.x = game.width * 0.5;
  this.cameraOffset.y = game.height * 0.5;
};

G.WindowLayer.prototype.cacheWindow = function(win) {
    this.add(win);
};

G.WindowLayer.prototype.onWindowClosed = function() {
  G.menuOpened = false;
  if (this.queue.length > 0) {
    var args = this.queue.splice(0, 1);
    new G.Window(args[0])
  } else {
    G.sb('onAllWindowsClosed').dispatch();
  }
};

G.WindowLayer.prototype.pushWindow = function(type, unshift) {
  G.menuOpened = true;
  if (this.queue.length == 0 && this.children.length == 0) {
    new G.Window(type);
  } else {
    if (unshift) {
      this.queue.unshift(type);
    } else {
      this.queue.push(type);
    }
  }
};
window.startGame = function() {
  sgSdk.initialize(['basic', 'scoreGame'], {
    build: "1.0.0",
    supportedLanguages: ['en', 'de', 'es', 'fr', 'it', 'pt', 'ru', 'tr', 'nl', 'pl', 'ar'],
    id: 'bubble-shooter-hd',

    freezeGame: function() {
        if (game) game.paused = true;
    },
    unfreezeGame: function() {
        if (game) game.paused = false;
    },
    runGame: function() {
        if(game) {
          game.state.start("Game");
          sdkHandler.trigger('start');
          sdkHandler.setAdClosedCallback(() => {
            window.focus();
          });

          window.addEventListener("blur", () => {
              // game.paused = true;
          });
          window.addEventListener("focus", () => {
              // game.paused = false;
          });

          const toMatch = [
              /Android/i,
              /webOS/i,
              /iPhone/i,
              /iPad/i,
              /iPod/i,
              /BlackBerry/i,
              /Windows Phone/i,
              /Samsung/i,
              /SamsungBrowser/i,
              /SAMSUNG/i
          ];
          var isIncluded = toMatch.some((toMatchItem) => {
              return navigator.userAgent.match(toMatchItem);
          });
          var isIpad = /Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints && navigator.maxTouchPoints > 1;
          game.device.desktop = !(isIncluded || isIpad);
        }
    },
    startOver: function() {},
    
    // gameAnalyticsKey: "27c0914683c3d8960db9e8bf26e18d0b",
    // gameAnalyticsSecret: "d49a43c3a361006eaef20877e99bd6984f12ff82"

  }, function(error, settings, sdkHandler) {
    if (error) console.error(error);

    window.sgSettings = settings; //an object contains your commands (settings.commands) and config (settings.config)
    window.sdkHandler = sdkHandler; //this is the sdk to be used to call events in the game
    
    var game = new Phaser.Game("100", "100", Phaser.CANVAS, '', null, true);
    window.game = game;

    game.state.add('Boot', G.Boot);
    game.state.add('Preloader', G.Preloader);
    game.state.add('MainMenu', G.MainMenu);
    game.state.add('Game', G.Game);
    game.state.start('Boot');

  });
}

G.ASSETS = {"spritesheets":["ssheet","ui"],"sfx":["bubble_hits_bubble.mp3","bubble_hits_wall.mp3","bubble_pops_1.mp3","bubble_pops_2.mp3","bubble_pops_3.mp3","button_click.mp3","lost.mp3","shoot_bubble.mp3","won.mp3"],"images":[],"json":["languages.json"],"fonts":{"button_font":{"data":"button_font.fnt","frame":"button_font.png"},"white_font":{"data":"white_font.fnt","frame":"white_font.png"},"yellow_font":{"data":"yellow_font.fnt","frame":"yellow_font.png"}}};

})()