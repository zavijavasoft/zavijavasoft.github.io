(function (win, doc, namespace) {
    'use strict';
    
    class ImageTranslationError extends Error {
        name = 'ImageTranslationError'
    
        constructor(originalError = null) {
            super();
            this.name = this.name || this.constructor.name;
            this.originalError = originalError;
        }
    }
    
    // main error groups
    class ProcessingError extends ImageTranslationError {
        name = 'ProcessingError'
    }
    class ImageError extends ImageTranslationError {
        name = 'ImageError'
    }
    class ApiError extends ImageTranslationError {
        name = 'ApiError'
    }
    
    // image errors
    class ImageCspError extends ImageError {
        name = 'ImageCspError'
    }
    class ImageTypeError extends ImageError {
        name = 'ImageTypeError'
    }
    class NotImageError extends ImageError {
        name = 'NotImageError'
    }
    class ImageSizeError extends ImageError {
        name = 'ImageSizeError'
    }
    class ImageLoadingError extends ImageError {
        name = 'ImageLoadingError'
    }
    class ImageLoadingTimeoutError extends ImageLoadingError {
        name = 'ImageLoadingTimeoutError'
    }
    
    // api errors
    class ApiTimeoutError extends ApiError {
        name = 'ApiTimeoutError'
    }
    class RecognitionError extends ApiError {
        name = 'RecognitionError'
    }
    class NoTextError extends RecognitionError {
        name = 'NoTextError'
    }
    class TranslationError extends ApiError {
        name = 'TranslationError'
    }
    class TranslationIsSameError extends TranslationError {
        name = 'TranslationIsSameError'
    }
    
    // local text detection errors
    class LocalTextDetectionError extends RecognitionError {
        name = 'LocalTextDetectionError'
    }
    class NoTextLocalDetectionError extends LocalTextDetectionError {
        name = 'NoTextLocalDetectionError'
    }
    class LocalTextDetectionUnknownError extends LocalTextDetectionError {
        name = 'LocalTextDetectionUnknownError'
    }
    
    class ImageFileType {
        /** @private */
        static _webpSupported;
    
        static WEBP = 'image/webp'
        static JPEG = 'image/jpeg'
        static PNG = 'image/png'
    
        static webpSupported() {
            if (this._webpSupported === undefined) {
                try {
                    const $canvas = doc.createElement('canvas');
                    this._webpSupported = !isFirefox() &&
                        $canvas.toDataURL(this.WEBP).indexOf('data:' + this.WEBP) === 0;
                } catch (e) {
                    this._webpSupported = false;
                }
            }
    
            return this._webpSupported;
        }
    }
    
    class ReplaceMode {
        static replaceSrc = 'replaceSrc';
        static replaceImg = 'replaceImg';
    }
    
    /**
     * @typedef MainSessionOptions
     * @type {Object}
     */
    
    class SessionOptions {
        ocrApiUrl = 'https://browser.translate.yandex.net/ocr/v1.1/recognize';
        translationApiUrl = 'https://browser.translate.yandex.net/api/v1/tr.json/translate';
        clckUrl = 'https://yandex.net/clck/click/';
    
        ocrSlowdown = {
            periodDuration: 60 * 1000, // ms
            requestsLimit: 20, // amount of requests
            timeoutCoef: 150, // ms [coef * (requestsPerPeriod - requestsLimit)]
        }
    
        clckOptions = {
            pid: '453',
            dtype: 'stred',
            keyPrefix: 'ytr_',
            maxDataLen: 1024,
            trackApiResponse: false,
        }
    
        clckCounters = {
            imageDone: '74076',
            imageRestored: '74077',
        }
    
        visualProgress = {
            doneDuration: 800,
            boundListenerInterval: 200,
            minimalClientWidth: 140,
            minimalClientHeight: 90,
        }
    
        minimalWidth = 76;
        minimalHeight = 44;
    
        skipSameTranslatedBlocks = true;
    
        useGrayscaleFilter = true;
        fillTransparentImages = true;
    
        imageQuality = 0.9; // 0-1
        imageMaxSideSize = 1024; // px
        imageFormat = ImageFileType.webpSupported() ?
            ImageFileType.WEBP : ImageFileType.JPEG;
    
        scrollingDebounce = 500;
        dumbWatcherInterval = 2000;
    
        textCondenseCriteria = {
            condenseRatioBorder: 2.4, // times - and higher will be highlighted
            absFontSizeBorder: 9.2, // px - abs font size to highlight phrase
            condenseToFontGrowRatio: 1, // times - condensed lines will have a smaller adjusted font
            bigAbsFontBorder: 16, // px - larger fonts will have lower condense ratio
        }
    
        textOverlayOptions = {
            showOnHover: true,
            showTextInHighlights: false,
            boundListenerCommonInterval: 500,
            boundListenerActiveInterval: 100,
        }
    
        transparencyFillingOptions = {
            transparencyBorder: 150, // 0-255
            minimalTransparentArea: 0.1 // 0-1
        }
    
        result = {
            enableContrastAdjusting: true,
            enableTextAdjusting: true,
            enableLinesXAlign: true,
            enableLinesHeightAlign: true,
            enableCondensedFont: true,
    
            arrangeBlockTranslations: true,
    
            enableTransparencyPatching: true,
            transparencyPatchingBorder: 0.5 * 255,
    
            extendLineWidth: true,
            extendableWidthToHhRatio: 0.15,
    
            blurLines: false,
    
            condensedFontFamily: 'Arial, Helvetica, sans-serif', // 'Roboto Condensed',
            fontFamily: 'Arial, Helvetica, sans-serif',
    
            useBlobObjectUrl: true,
    
            hhToFontSizeRatio: 1.6,
            preferableFormat: ImageFileType.webpSupported() ?
                ImageFileType.WEBP : ImageFileType.JPEG,
        }
    
        contrastOptions = { // 0-100
            minLightnessDelta: 32,
            targetLightnessDelta: 44,
            minTargetLightnessDelta: 32,
        }
    
        session = /** @lends MainSessionOptions# */{
            threads: 1,
            sid: Api.generateSid(),
            srcAutodetect: true,
            srcLang: 'en',
            dstLang: 'ru',
            ocrSrv: 'yabrowser',
            trnslSrv: 'yabrowser-ocr',
            replaceOriginals: true,
            viewportOnly: true,
            viewportPreloadScreens: 2,
            enableVisualProgress: false,
            enableTextPopup: true,
            translateBackgrounds: false,
            $root: doc.documentElement,
            mode: CustomHooks.useSoftSwap() ?
                ReplaceMode.replaceSrc : ReplaceMode.replaceImg,
        }
    
        /**
         * @param {MainSessionOptions|Object} sessionOptions
         */
        constructor(sessionOptions = {}) {
            this.updateSessionOptions(sessionOptions);
        }
    
        updateSessionOptions(sessionOptions = {}) {
            for (const k in sessionOptions) {
                if (sessionOptions.hasOwnProperty(k)) {
                    this.session[k] = sessionOptions[k];
                }
            }
        }
    
        static patchDefaultOptions(patch) {
            for (const k in patch) {
                if (!patch.hasOwnProperty(k)) {
                    continue;
                }
    
                if (typeof patch[k] === 'object' && typeof this[k] === 'object') {
                    this[k] = { ...this[k], ...patch[k] };
                } else {
                    this[k] = patch[k];
                }
            }
        }
    }
    
    class CanvasImage {
        _$canvas;
    
        /**
         * @returns {HTMLCanvasElement}
         */
        getCanvas() {
            if (!this._$canvas) {
                try {
                    this._$canvas = this._makeCanvas();
                } catch (e) {
                    if (e instanceof DOMException) {
                        throw new ImageCspError(e);
                    }
                    throw e;
                }
            }
            return this._$canvas;
        }
    
        /**
         * @returns {CanvasRenderingContext2D}
         */
        getCanvasCtx() {
            return this.getCanvas().getContext('2d');
        }
    
        /**
         * @returns {{ width, height }}
         */
        getSizes() {
            const { width, height } = this.getCanvas();
            return { width, height };
        }
    
        /**
         * @abstract
         * @private
         * @returns {HTMLCanvasElement}
         */
        _makeCanvas() {}
    
        /**
         * @protected
         * @param {HTMLImageElement} $image
         */
        _drawImageOnCanvas($image) {
            const $canvas = this.getCanvas();
    
            CanvasImage.drawImage($canvas, $image, 0, 0, $canvas.width, $canvas.height);
        }
    
        /**
         * @param {HTMLCanvasElement} $canvas
         * @param {*} drawImageArgs arguments
         */
        static drawImage($canvas, ...drawImageArgs) {
            const ctx = $canvas.getContext('2d');
    
            ctx.drawImage(...drawImageArgs);
        }
    
        /**
         * Creates canvas element with cleared origin flag, when used in yabro
         * @return {HTMLCanvasElement}
         */
        static createCanvasElement() {
            const $canvas = doc.createElement('canvas');
    
            ImageTranslator.processCanvasElement($canvas);
    
            return $canvas;
        }
    }
    
    class Color {
        static components = ['r', 'g', 'b', 'a'];
    
        r; g; b; a;
    
        constructor(r, g, b, a = 255) {
            const obj = { r, g, b, a };
    
            for(const c in obj) {
                this[c] = Math.max(0, Math.min(255, Math.round(obj[c])));
            }
        }
    
        toArray() {
            return [ this.r, this.g, this.b, this.a ];
        }
    
        toRgba() {
            const [r, g, b, a] = this.toArray();
            return `rgba(${r}, ${g}, ${b}, ${a / 255})`
        }
    
        toString() {
            return this.toRgba();
        }
    
        /**
         * @param {Uint8ClampedArray|Array} data
         * @returns {Color}
         */
        static fromImageData(data) {
            const [r, g, b, a] = data;
            return new Color(r, g, b, a);
        }
    
        /**
         * @param {Object} data
         * @returns {Color}
         */
        static fromObject({ r, g, b, a }) {
            return new Color(r, g, b, a);
        }
    
        /**
         * @param {Color[]} colors
         */
        static findMedian(colors) {
            const medianColor = {};
    
            for(const c of this.components) {
                medianColor[c] = Math.round(
                    calcMedian(colors.map((color) => color[c])));
            }
    
            return this.fromObject(medianColor);
        }
    
        /**
         * @param {Color} text
         * @param {Color} bg
         * @param {Object<SessionOptions.contrastOptions>} options
         */
        static getAdjustedColor(text, bg, options) {
            if (bg.a < 256 / 8) { // base transparent
                return text;
            }
    
            const [h, s, textLns] = rgbToHsl(...text.toArray());
            const [,, bgLns] = rgbToHsl(...bg.toArray());
            const deltaLns = Math.abs(textLns - bgLns);
    
            if (deltaLns > options.minLightnessDelta) {
                return text;
            }
    
            const targetDelta = options.targetLightnessDelta;
            const minTargetDelta = options.minTargetLightnessDelta;
    
            let newLns;
    
            if (bgLns > textLns) { // text is darker than bg
                if (bgLns < minTargetDelta) { // bg is darker than we needed
                    newLns = bgLns + targetDelta; // inverting text color
                } else {
                    newLns = Math.max(bgLns - targetDelta, 0); // make color darker
                }
            } else { // text lighter than bg
                if (textLns + minTargetDelta > 100) {
                    newLns = bgLns - targetDelta;
                } else {
                    newLns = Math.min(bgLns + targetDelta, 100);
                }
            }
    
            return new Color(...hslToRgb(h, s, newLns));
        }
    }
    
    class ImagesWatcher {
        static CHILD_LIST_TYPE = 'childList';
        static ATTRS_TYPE = 'attributes';
    
        /** @private */
        static _expectedAppears = new WeakMap();
        /** @private */
        static _expectedDisappears = new WeakMap();
    
        /** @private */
        _appearHandlers = [];
        /** @private */
        _disappearHandlers = [];
        /** @private */
        _enableHandlers = [];
        /** @private */
        _disableHandlers = [];
    
        /**
         * @param {SessionOptions} options
         */
        constructor(options) {
            this.options = options;
            this.observer = new MutationObserver((mutations) => {
                setTimeout(() => this._handleMutations(mutations), 0);
            });
        }
    
        onImagesAppear(callback) {
            this._appearHandlers.push(callback);
            return this;
        }
    
        onImagesDisappear(callback) {
            this._disappearHandlers.push(callback);
            return this;
        }
    
        onImagesEnabled(callback) {
            this._enableHandlers.push(callback);
            return this;
        }
    
        onImagesDisabled(callback) {
            this._disableHandlers.push(callback);
            return this;
        }
    
        isActive() {
            return this._active;
        }
    
        start() {
            if (this._active) {
                return;
            }
    
            this.observer.observe(this.options.session.$root, {
                attributeFilter: [HtmlElement.TRANSLATE_ATTR],
                attributeOldValue: true,
                attributes: true,
                childList: true,
                subtree: true,
            });
    
            this._active = true;
        }
    
        stop() {
            if (this._active) {
                this._active = false;
                this.observer.disconnect();
            }
        }
    
        _callHandlers($$images, handlers) {
            if ($$images.length) {
                handlers.forEach((handler) => {
                    try {
                        handler($$images);
                    } catch (e) {}
                });
            }
        }
    
        _callElementsHandlers(nodeList, filterMap, handler) {
            const $$images = Array.from(nodeList)
                .filter(($el) => HtmlElement.isImageLikeElement($el))
                .filter(($image) => {
                    if (filterMap.has($image)) {
                        filterMap.delete($image);
                        return false;
                    }
                    return true;
                });
    
            this._callHandlers($$images, handler);
        }
    
        _handleNodeListMutation(mutation) {
            this._callElementsHandlers(
                mutation.addedNodes, ImagesWatcher._expectedAppears, this._appearHandlers);
            this._callElementsHandlers(
                mutation.removedNodes, ImagesWatcher._expectedDisappears, this._disappearHandlers);
        }
    
        _handleAttrsMutation(mutation) {
            if (mutation.attributeName !== HtmlElement.TRANSLATE_ATTR) {
                return;
            }
    
            const $target = mutation.target;
            const $$images = Array.from($target.querySelectorAll('img'));
    
            if ($$images.length) {
                const newVal = $target.getAttribute(HtmlElement.TRANSLATE_ATTR);
                const prevVal = mutation.oldValue;
    
                if (prevVal === HtmlElement.TRANSLATE_NO) {
                    this._callHandlers($$images, this._enableHandlers);
                } else if (newVal === HtmlElement.TRANSLATE_NO) {
                    this._callHandlers($$images, this._disableHandlers);
                }
            }
        }
    
        _handleMutations(mutations) {
            if (!this._active) {
                return;
            }
    
            for(const mutation of mutations) {
                if (mutation.type === ImagesWatcher.CHILD_LIST_TYPE) {
                    this._handleNodeListMutation(mutation);
                } if (mutation.type === ImagesWatcher.ATTRS_TYPE) {
                    this._handleAttrsMutation(mutation);
                }
            }
        }
    
        static forewarnAppear($image) {
            this._expectedAppears.set($image, true);
        }
    
        static forewarnDisappear($image) {
            this._expectedDisappears.set($image, true);
        }
    }
    
    class ImageStats {
        static benchmarks = {
            preparation: 'pp',
            ocrApi: 'oa',
            ocrBlob: 'ob',
            ocrPatch: 'op',
            ocrResize: 'or',
            translationApi: 'ta',
            svgContent: 'sc',
            svgImage: 'si',
            resultImage: 'ri',
            arrangeTexts: 'at',
        }
    
        static statKeys = {
            ocrSize: 'ocrSize',
            resSize: 'resSize',
            ocrWidth: 'ocrWidth',
            ocrHeight: 'ocrHeight',
            origWidth: 'origWidth',
            origHeight: 'origHeight',
            clientWidth: 'clientWidth',
            clientHeight: 'clientHeight',
        }
    
        /** @private */
        _stats = {}
        /** @private */
        _starts$ = {}
        /** @private */
        _ends$ = {}
        /** @private */
        _sums$ = {}
    
        constructor() {
            this.id = Api.generateSid();
        }
    
        /**
         * @param {String<ImageStats.benchmarks>} key
         * @return {function(): *} Function for benchmark termination
         */
        start$(key) {
            this._starts$[key] = Date.now();
    
            return () => this.stop$(key);
        }
    
        sum$(key) {
            const start = Date.now();
            return () => this._sums$[key] = (this._sums$[key] || 0) + Date.now() - start;
        }
    
        stop$(key) {
            this._ends$[key] = Date.now();
        }
    
        invalidateSum() {
            this._sums$ = {};
        }
    
        setStat(key, value) {
            this._stats[key] = value;
        }
    
        getStat(key) {
            return this._stats[key];
        }
    
        getStatsMap() {
            return this._stats;
        }
    
        getOcrImageScale() {
            const ow = this._stats[ImageStats.statKeys.ocrWidth];
            const oh = this._stats[ImageStats.statKeys.ocrHeight];
            const cw = this._stats[ImageStats.statKeys.clientWidth];
            const ch = this._stats[ImageStats.statKeys.clientHeight];
    
            if (ow && oh && cw && ch) {
                return [cw / ow, ch / oh];
            }
    
            return null;
        }
    
        getStats() {
            return Object.fromEntries(
                Object.values(ImageStats.statKeys).map((key) => {
                    return [key, this._stats[key]];
                })
            );
        }
    
        getBenchmarkStats() {
            return Object.fromEntries(
                Object.values(ImageStats.benchmarks).map((key) => {
                    const start = this._starts$[key];
                    const end = this._ends$[key];
                    const sum = this._sums$[key];
                    return sum ? [key, sum] : [key, start && end ? end - start : null];
                })
            );
        }
    }
    
    class ImageTranslator {
        static canvasProcessor;
        static textDetectorHandler;
        static _textDetectionStatusBySrc = {};
    
        _newImgControllerHandlers = [];
        _progressHandlers = [];
        _usedImageControllers = [];
        _usedOrigImages = new WeakMap();
        _imageControllers = new WeakMap();
        _imagesWatcher;
        _active = false;
        _threadsBusy = false;
        _progress = null;
        _bulkProgress = null;
        _prevProgressTotalItems = 0;
    
        /**
         * @param {MainSessionOptions|Object} sessionOptions
         */
        constructor(sessionOptions = {}) {
            /** @type {ImageController[]} */
            this.queue = [];
            this.options = new SessionOptions(sessionOptions);
    
            ImageTranslatorStyles.ensureStyles();
        }
    
        /**
         * @param {MainSessionOptions} sessionOptions
         */
        async updateSession(sessionOptions) {
            const options = new SessionOptions(this.options.session);
    
            options.updateSessionOptions(sessionOptions);
    
            this.options = options;
            this._actualizeQueue();
    
            this.queue.forEach((imgCtrl) => {
                imgCtrl.updateOptions(options);
            });
        }
    
        /**
         * @param {HTMLElement} $image
         * @param {Boolean=true} waitOnload
         * @returns {Promise<ImageController|null>}
         */
        async getImageController($image, waitOnload = true) {
            if (!waitOnload && (!isImageLoaded($image) || !isBgLoaded($image))) {
                return null;
            }
    
            return this._getImageController($image);
        }
    
        translate() {
            this._active = true;
            this._actualizeQueue();
    
            this.queue.forEach(async (imgCtrl) => {
                if (imgCtrl.getStatus() === ImageControllerStatuses.TRANSLATED) {
                    await imgCtrl.translate(null, ImageTranslationReasons.QUEUE);
                }
            });
    
            this._activateGlobalWatcher();
            this._startWatcher();
            this._moveQueue();
        }
    
        restore() {
            this.pause();
            this._actualizeQueue();
    
            this.queue.forEach(async (imgCtrl) => {
                if (imgCtrl.isInProgress()) {
                    imgCtrl.cancelProcessing();
                }
    
                await imgCtrl.restoreOriginal(null, ImageTranslationReasons.QUEUE);
            });
        }
    
        continue() {
            this._active = true;
            this._startWatcher();
        }
    
        pause() {
            this._active = false;
            this._pauseWatcher();
        }
    
        /**
         * @param {function(imgCtrl: ImageController): void} handler
         * @return {ImageTranslator}
         */
        onImageController(handler) {
            this._newImgControllerHandlers.push(handler);
            return this;
        }
    
        /**
         * @param {function(bulkProgress: Number, progress: Number, data: Object): void} handler
         * @return {ImageTranslator}
         */
        onProgress(handler) {
            this._progressHandlers.push(handler);
            return this;
        }
    
        getProgress() {
            return this._progress || 0;
        }
    
        getBulkProgress() {
            return this._bulkProgress || 0;
        }
    
        async _getImageController($img) {
            if (!HtmlElement.isImageLikeElement($img)) {
                throw new NotImageError();
            }
    
            if (ImageController.isTranslatedImage($img)) {
                return this._findImageControllerByTranslatedImage($img);
            }
    
            if (!this._imageControllers.has($img)) {
                const stats = new ImageStats();
                try {
                    const origImage = HtmlElement.isImageElement($img) ?
                        await OrigImage.fromImageElement($img, this.options, stats) :
                        await OrigImage.fromImageLikeElement($img, this.options, stats);
    
                    const imgCtrl = new ImageController(origImage, this.options, stats);
    
                    imgCtrl.onForget(() => this._forgetImageController(imgCtrl));
    
                    this._usedImageControllers.push(imgCtrl);
                    this._imageControllers.set($img, imgCtrl);
                } catch (e) {
                    return null;
                }
            }
    
            return this._imageControllers.get($img);
        }
    
        _getImagesWatcher() {
            if (!this._imagesWatcher) {
                this._imagesWatcher = new ImagesWatcher(this.options);
    
                this._imagesWatcher
                    .onImagesAppear(this._handleImagesAppear.bind(this))
                    .onImagesDisappear(this._handleImagesDisappear.bind(this))
                    .onImagesEnabled(this._handleImagesEnabled.bind(this))
                    .onImagesDisabled(this._handleImagesDisabled.bind(this))
            }
    
            return this._imagesWatcher;
        }
    
        _activateGlobalWatcher() {
            if (this._globalWatcherActivated) {
                return;
            }
    
            if (this.options.session.viewportOnly) {
                this._updateViewportImages();
                this._listenScroll();
                this._startDumbWatcher();
            } else {
                this._handleImagesAppear(this._getRootImages());
            }
    
            this._globalWatcherActivated = true;
        }
    
        _startWatcher() {
            this._getImagesWatcher().start();
        }
    
        _pauseWatcher() {
            this._getImagesWatcher().stop();
        }
    
        _updateImagesAndMove() {
            if (this._active && this.options.session.viewportOnly) {
                this._updateViewportImages();
    
                if (!this._threadsBusy) {
                    this._moveQueue();
                }
            }
        }
    
        _startDumbWatcher() {
            setInterval(() => {
                this._updateImagesAndMove();
            }, this.options.dumbWatcherInterval);
        }
    
        _listenScroll() {
            win.addEventListener('scroll', debounce(() => {
                this._updateImagesAndMove();
            }, this.options.scrollingDebounce));
        }
    
        _findImageController($image) {
            if (ImageController.isTranslatedImage($image)) {
                return this._findImageControllerByTranslatedImage($image);
            }
    
            return this._imageControllers.get($image);
        }
    
        _findImageControllerByTranslatedImage($image) {
            return this._usedImageControllers
                .find((imgCtrl) => imgCtrl._$translatedImage === $image);
        }
    
        _getRootImages() {
            const $root = this.options.session.$root;
            const $$images = Array.from($root.querySelectorAll('img'));
    
            if (this.options.session.translateBackgrounds) {
                const $$imageLike = Array.from($root.querySelectorAll('div'))
                    .filter(($el) => HtmlElement.isElementWithBgImage($el));
    
                $$images.push(...$$imageLike);
            }
    
            return $$images
                .filter(($img) => this._isNewOriginalImage($img))
                .filter(($img) => {
                    if (!HtmlElement.isImageElement($img)) {
                        return OrigImage.checkClientSizes($img, this.options);
                    }
    
                    return !$img.naturalHeight || (
                        OrigImage.checkNaturalSizes($img, this.options) &&
                        OrigImage.checkClientSizes($img, this.options));
                });
        }
    
        _updateViewportImages() {
            const $$images = this._getRootImages()
                .filter(($img) => HtmlElement.isElementInViewport(
                    $img, this.options.session.viewportPreloadScreens));
    
            if ($$images.length) {
                this._handleImagesAppear($$images);
            }
        }
    
        _addImageController(imgCtrl) {
            if(!imgCtrl || this.queue.includes(imgCtrl)) {
                return;
            }
    
            imgCtrl.onStatusChange(() => this._moveQueue());
    
            this.queue.push(imgCtrl);
    
            this._newImgControllerHandlers.forEach((handler) => {
                try {
                    handler(imgCtrl);
                } catch (e) {}
            });
    
            this._moveQueue();
        }
    
        _setProgress(total, done, inProgress, inQueue) {
            const bulkTotal = total - this._prevProgressTotalItems;
            const bulkDone = done - this._prevProgressTotalItems;
    
            const progress = ImageProgress.countProgress(total, done, inProgress);
            const bulkProgress = ImageProgress.countProgress(bulkTotal, bulkDone, inProgress);
    
            if (progress === 100) {
                this._prevProgressTotalItems = total; // bulk is done
            }
    
            if (this._progress === progress &&
                this._bulkProgress === bulkProgress) {
                return;
            }
    
            this._progress = progress;
            this._bulkProgress = progress;
    
            this._progressHandlers.forEach((handler) => {
                try {
                    handler(bulkProgress, progress, {
                        total, done,
                        bulkDone, bulkTotal,
                        inProgress, inQueue,
                    });
                } catch (e) {}
            });
        }
    
        _isNewOriginalImage($img) {
            return ImageController.isOriginalImage($img) && !this._usedOrigImages.has($img);
        }
    
        _handleImagesAppear($$images) {
            const $$origImages = $$images
                .filter(($img) => {
                    if (HtmlElement.isImageElement($img)) {
                        if (isImageLoaded($img)) {
                            return true;
                        }
                        this._addImageOnload($img);
                    } else {
                        if (isBgLoaded($img)) {
                            return true;
                        }
                        this._addElBgOnload($img);
                    }
                    return false;
                })
                .filter(($img) => this._isNewOriginalImage($img));
    
            const controllerPromises = $$origImages
                .map(($img) => this.getImageController($img));
    
            const handleImgPromise = (promise) => {
                promise.then((imgCtrl) => {
                    this._addImageController(imgCtrl);
                }).finally(() => {
                    if (controllerPromises.length) {
                        handleImgPromise(controllerPromises.shift());
                    }
                });
            };
    
            if (controllerPromises.length) {
                $$origImages.forEach(($img) => this._usedOrigImages.set($img, true));
    
                handleImgPromise(controllerPromises.shift());
            }
        }
    
        _handleImagesDisappear($$images) {
            $$images
                .filter(($img) => ImageController.isOriginalImage($img))
                .map(($img) => this._findImageController($img))
                .filter((imgCtrl) => imgCtrl)
                .forEach((imgCtrl) => imgCtrl.disable());
        }
    
        _handleImagesEnabled($$images) {
            $$images
                .map(($img) => this._findImageController($img))
                .filter((imgCtrl) => imgCtrl)
                .forEach((imgCtrl) => imgCtrl.enable());
    
            this._moveQueue();
        }
    
        _handleImagesDisabled($$images) {
            $$images
                .map(($img) => this._findImageController($img))
                .filter((imgCtrl) => imgCtrl)
                .forEach((imgCtrl) => {
                    imgCtrl.disable();
                    imgCtrl
                        .restoreOriginal(null, ImageTranslationReasons.INVALIDATION)
                        .then(() => imgCtrl.setStatus(ImageControllerStatuses.INIT));
                });
        }
    
        _addElBgOnload($el) {
            if ($el[OrigImage.$YTR_LINKED_IMG]) {
                return;
            }
    
            OrigImage.ensureLinkedImgForImageLikeElement($el);
    
            const $img = $el[OrigImage.$YTR_LINKED_IMG];
    
            waitImageLoaded($img)
                .then(() => {
                    if (isBgLoaded($el)) {
                        this._handleImagesAppear([$el]);
                    }
                })
                .catch(() => {});
        }
    
        _addImageOnload($img) {
            const onload = () => {
                if (isImageLoaded($img)) {
                    this._handleImagesAppear([$img]);
                }
            };
    
            if ($img.ytrOnload) {
                $img.removeEventListener('load', $img.ytrOnload);
            }
    
            $img.addEventListener('load', onload);
            $img.ytrOnload = onload;
        }
    
        _moveQueue() {
            if (!this._active) {
                return;
            }
    
            this._updateProgress();
    
            const { session } = this.options;
    
            const queue = this.queue
                .filter((imgCtrl) => imgCtrl.isEnabled())
                .filter((imgCtrl) => session.viewportOnly ?
                    imgCtrl.origImage.isInViewport() : true);
    
            const inProgress = this.queue
                .filter((imgCtrl) => imgCtrl.isEnabled())
                .filter((imgCtrl) => imgCtrl.isInProgress());
    
            const freeThreads = session.threads - inProgress.length;
    
            if (!freeThreads) {
                this._threadsBusy = true;
                return;
            }
    
            const idle = queue.filter((imgCtrl) => imgCtrl.isIdle());
            const nextPortion = idle.slice(0, freeThreads);
    
            this._threadsBusy = freeThreads === nextPortion.length;
    
            nextPortion.forEach(async (imgCtrl) => {
                await imgCtrl.translate(null, ImageTranslationReasons.QUEUE);
            });
        }
    
        _updateProgress() {
            const { session } = this.options;
    
            let totalItems = 0;
            let done = 0;
            let inProgress = 0;
            let inQueue = 0;
    
            this.queue.forEach((imgCtrl) => {
                if (!imgCtrl.isEnabled()) return;
    
                const progress = imgCtrl.getProgress();
    
                // ignoring non-viewport images that won't be translated atm
                if (!progress && session.viewportOnly && !imgCtrl.origImage.isInViewport()) {
                    return;
                }
    
                switch (progress) {
                    case ImageProgress.IDLE: inQueue += 1; break;
                    case ImageProgress.IN_PROGRESS: inProgress += 1; break;
                    case ImageProgress.DONE: done += 1; break;
                }
    
                totalItems += 1;
            });
    
            if (totalItems) {
                this._setProgress(totalItems, done, inProgress, inQueue);
            }
        }
    
        _actualizeQueue() {
            this._usedImageControllers
                .filter((imgCtrl) => !this.queue.includes(imgCtrl))
                .forEach((imgCtrl) => this._addImageController(imgCtrl));
        }
    
        /**
         * @param {ImageController} imgCtrl
         */
        _forgetImageController(imgCtrl) {
            const $origImage = imgCtrl.getOriginalImage();
    
            this._usedOrigImages.delete($origImage);
            this._imageControllers.delete($origImage);
    
            removeArrayElement(this.queue, imgCtrl);
            removeArrayElement(this._usedImageControllers, imgCtrl);
        }
    
        /**
         * @param {function($canvas: HTMLCanvasElement)} processorHandler
         */
        static setGlobalCanvasProcessor(processorHandler) {
            this.canvasProcessor = processorHandler;
        }
    
        static processCanvasElement($canvas) {
            if (this.canvasProcessor) {
                try {
                    this.canvasProcessor($canvas);
                } catch (e) {}
            }
        }
    
        /**
         * @param {function($image: HTMLImageElement)} detectorHandler
         */
        static setGlobalImageTextDetector(detectorHandler) {
            this.textDetectorHandler = detectorHandler;
        }
    
        static async getImageTextDetectionStatus($image) {
            if (!this._textDetectionStatusBySrc[$image.src]) {
                const status = await this._getImageTextDetectionStatus($image);
    
                this._textDetectionStatusBySrc[$image.src] = status ||
                    TextDetectionStatuses.NOT_IMPLEMENTED;
            }
    
            return this._textDetectionStatusBySrc[$image.src];
        }
    
        static async _getImageTextDetectionStatus($image) {
            if (!this.textDetectorHandler) {
                return TextDetectionStatuses.NOT_IMPLEMENTED;
            }
    
            return new Promise((resolve) => {
                try {
                    this.textDetectorHandler($image, (status) => {
                        resolve(status);
                    });
                } catch (e) {
                    resolve(TextDetectionStatuses.ERROR);
                }
            });
        }
    
        static isElementTranslatable($el) {
            return HtmlElement.isElementTranslatable($el);
        }
    }
    
    class ImageControllerStatuses {
        static INIT = 'init';
        static PREPARING = 'preparing'; // for local text detection
        static IN_PROGRESS = 'in_progress';
        static TRANSLATED = 'translated'; // also a default state after restore
        static REPLACED = 'replaced';
        static SKIPPED = 'skipped';
    
        static CANCELED = 'canceled';
        static FAILED = 'failed';
    }
    
    class ImageTranslationReasons {
        static QUEUE = 'queue';
        static TARGET = 'target';
        static INVALIDATION = 'invalidation';
    }
    
    class TextDetectionStatuses {
        static NOT_IMPLEMENTED = 'not-implemented'; // system status
        static NO_TEXT = 'no-text';
        static STRONG_TEXT = 'strong-text';
        static SOFT_TEXT = 'soft-text';
        static ERROR = 'error';
    }
    
    class ImageProgress {
        static IDLE = 0;
        static IN_PROGRESS = 50;
        static DONE = 100;
    
        static countProgress(total, done, inProgress) {
            return total ? (done * this.DONE +
                inProgress * this.IN_PROGRESS) / total : this.DONE;
        }
    }
    
    class ImageController {
        /** @private */
        static _$$translatedImages = [];
    
        /** Image id */
        id = null;
        /** @type {String<TextDetectionStatuses>} */
        textDetectionStatus;
        /** @private */
        _error = null;
        /** @private */
        _status = ImageControllerStatuses.INIT;
        /** @private */
        _$translatedImage;
        /** @private */
        _replaced = false;
        /** @private */
        _statusHandlers = [];
        /** @private */
        _forgetHandlers = [];
        /** @private */
        _enabled = true;
        /** @private */
        _reason = null;
        /** @private */
        _ownSrcs = [];
    
        /**
         * @param {OrigImage} origImage
         * @param {SessionOptions} options
         * @param {ImageStats} stats
         */
        constructor(origImage, options, stats) {
            this._enabled = HtmlElement.isElementTranslationAllowed(origImage.getElement());
    
            this.origImage = origImage;
            this.ocrImage = new OcrImage(origImage, options, stats);
            this.translatedImage = new TranslatedImage(origImage, this.ocrImage, options, stats);
            this.options = options;
            this.stats = stats;
    
            this._ownSrcs.push(origImage.getImageSrc());
    
            if (origImage.getBgSrc()) {
                this._ownSrcs.push(origImage.getBgSrc());
            }
            if (origImage.getBgOrigSrc()) {
                this._ownSrcs.push(origImage.getBgOrigSrc());
            }
    
            this._trackSrc();
            this._trackStatus();
            this._trackTextOverlay();
            this._trackVisualProgress();
        }
    
        enable() {
            this._enabled = true;
        }
    
        disable() {
            this._enabled = false;
        }
    
        isEnabled() {
            return this._enabled;
        }
    
        /**
         * @param {MainSessionOptions} sessionOptions
         */
        async updateSession(sessionOptions) {
            return this.updateOptions(new SessionOptions(sessionOptions));
        }
    
        /**
         * @param {SessionOptions} options
         */
        async updateOptions(options) {
            const newSession = options.session;
            const prevSession = this.options.session;
    
            await this.restoreOriginal(null, ImageTranslationReasons.INVALIDATION);
    
            this.options = options;
    
            if (newSession.srcLang !== prevSession.srcLang ||
                newSession.srcAutodetect !== prevSession.srcAutodetect) {
                this._invalidateRecognition();
                this._invalidateTranslation();
            } else {
                this._invalidateTranslation();
            }
    
            this.setError(null);
            this.setStatus(ImageControllerStatuses.INIT, true);
        }
    
        /**
         * @param {function(String<ImageControllerStatuses>, {prevStatus: String})=} handler
         * @return {ImageController}
         */
        onStatusChange(handler) {
            this._statusHandlers.push(handler);
            return this;
        }
    
        /**
         * @param {Function} handler
         * @return {ImageController}
         */
        onForget(handler) {
            this._forgetHandlers.push(handler);
            return this;
        }
    
        /**
         * @param {Function} handler
         */
        offStatusChange(handler) {
            const index = this._statusHandlers.indexOf(handler);
    
            if (index !== -1) {
                this._statusHandlers.splice(index, 1);
            }
        }
    
        /** @private */
        setStatus(status, force = false) {
            if (this._status !== status || force) {
                const prevStatus = this._status;
                const reason = this._reason;
    
                this._status = status;
                this._statusHandlers.forEach((handler) => {
                    try {
                        handler(status, { prevStatus, reason });
                    } catch (e) {}
                });
            }
        }
    
        /**
         * @return {String}
         */
        getStatus() {
            return this._status;
        }
    
        /** @private */
        setError(error) {
            this._error = error;
        }
    
        /**
         * @return {ImageError|null}
         */
        getError() {
            return this._error;
        }
    
        /** @private */
        setReason(reason) {
            this._reason = reason;
        }
    
        isReplaced() {
            return this._replaced;
        }
    
        cancelProcessing() {
            this.setStatus(ImageControllerStatuses.CANCELED);
        }
    
        /**
         * @return {HTMLElement}
         */
        getOriginalImage() {
            return this.origImage.getElement();
        }
    
        /**
         * @param {function(String<ImageControllerStatuses>)=} statusHandler
         * @param {String<ImageTranslationReasons>} reason
         * @return {Promise<void|undefined>}
         */
        async translate(statusHandler = null, reason = null) {
            if (this.options.session.replaceOriginals) {
                return await this.replaceWithOriginal(statusHandler, reason);
            } else {
                return await this.prepareForReplacing(statusHandler, reason);
            }
        }
    
        /**
         * @return {Promise<HTMLImageElement>}
         */
        async getTranslatedImage() {
            await this.getOperationalTranslatedImage();
            return this.getOperationalImage();
        }
    
        /**
         * @return {Promise<HTMLImageElement>}
         */
        async getOperationalTranslatedImage() {
            if (this._$translatedImage) {
                return this._$translatedImage;
            }
    
            if (this._translateImagePromise) {
                return this._translateImagePromise;
            }
    
            this._translateImagePromise = new Promise(async (resolve, reject) => {
                try {
                    this._$translatedImage = await this.translatedImage.getImage();
                } catch (e) {
                    return reject(e);
                }
    
                ImageController._$$translatedImages.push(this._$translatedImage);
                this._ownSrcs.push(this._$translatedImage.src);
    
                resolve(this._$translatedImage);
    
                setTimeout(() => {
                    this._trackTranslatedImage(this.getOperationalImage());
                }, 0);
            });
    
            return this._translateImagePromise;
        }
    
        getOperationalImage() {
            if (!this.origImage.isImageElement()) {
                return this.getOriginalImage();
            }
    
            if (this.options.session.mode === ReplaceMode.replaceSrc) {
                return this.getOriginalImage();
            }
    
            return this._$translatedImage;
        }
    
        /**
         * @return {Promise<SVGElement>}
         */
        async _getOverlaySvg() {
            return await this.translatedImage.getOverlaySvg();
        }
    
        /**
         * @param {function(String<ImageControllerStatuses>)=} statusHandler
         * @param {String<ImageTranslationReasons>=target} reason
         * @return {Promise}
         */
        async prepareForReplacing(statusHandler = null, reason = null) {
            this.setReason(reason || ImageTranslationReasons.TARGET);
    
            const updateStatus = (status) => {
                this.setStatus(status);
    
                if (statusHandler) {
                    statusHandler(status);
                }
            };
    
            updateStatus(ImageControllerStatuses.IN_PROGRESS);
    
            await this.getOperationalTranslatedImage();
    
            updateStatus(ImageControllerStatuses.TRANSLATED);
        }
    
        /**
         * @param {function(String<ImageControllerStatuses>)=} statusHandler
         * @param {String<ImageTranslationReasons>=target} reason
         * @return {Promise<void>}
         */
        async replaceWithOriginal(statusHandler = null, reason = null) {
            this.setReason(reason || ImageTranslationReasons.TARGET);
    
            const updateStatus = (status) => {
                this.setStatus(status);
    
                if (statusHandler) {
                    statusHandler(status);
                }
            };
    
            if (this._replaced) {
                updateStatus(ImageControllerStatuses.REPLACED);
                return;
            }
    
            try {
                updateStatus(ImageControllerStatuses.PREPARING);
    
                await this._safeCheckTextPresence();
    
                updateStatus(ImageControllerStatuses.IN_PROGRESS);
    
                const $translatedImage = await this.getOperationalTranslatedImage();
    
                await waitImageLoaded($translatedImage, 5000);
    
                if (this._replaced) {
                    updateStatus(ImageControllerStatuses.REPLACED);
                    return;
                }
    
                if (this._status !== ImageControllerStatuses.CANCELED) {
                    updateStatus(ImageControllerStatuses.TRANSLATED);
    
                    this._removePictureSources(this.getOriginalImage());
    
                    if (!this.origImage.isImageElement()) {
                        this._setElementBackground(this.getOriginalImage(), $translatedImage);
                        await wait(100);
                    } else if (this.options.session.mode === ReplaceMode.replaceSrc) {
                        this._setTranslationSrc(this.getOriginalImage(), $translatedImage);
                        await waitImageLoaded(this.getOriginalImage(), 5000);
                        await wait(100); // load event could not fire
                    } else {
                        this._swapImages(this.getOriginalImage(), $translatedImage);
                    }
    
                    updateStatus(ImageControllerStatuses.REPLACED);
    
                    if (!this.origImage.isImageElement()) {
                        CustomHooks.afterBgReplace(this, this.getOriginalImage());
                    } else if (this.options.session.mode === ReplaceMode.replaceSrc) {
                        CustomHooks.afterSrcReplace(this, this.getOriginalImage());
                    } else {
                        CustomHooks.afterReplace(this, $translatedImage, this.getOriginalImage());
                    }
    
                    this._replaced = true;
                } else {
                    updateStatus(ImageControllerStatuses.TRANSLATED);
                }
            } catch (e) {
                this.setError(e);
    
                if (e instanceof LocalTextDetectionError &&
                    this._status === ImageControllerStatuses.PREPARING) {
                    updateStatus(ImageControllerStatuses.SKIPPED);
                } else {
                    updateStatus(ImageControllerStatuses.FAILED);
                }
            }
        }
    
        /**
         * @param {function(String<ImageControllerStatuses>)=} statusHandler
         * @param {String<ImageTranslationReasons>=target} reason
         * @returns {Promise}
         */
        async restoreOriginal(statusHandler = null, reason = null) {
            this.setReason(reason || ImageTranslationReasons.TARGET);
    
            const updateStatus = (status) => {
                this.setStatus(status);
    
                if (statusHandler) {
                    statusHandler(status);
                }
            };
    
            if (!this._replaced) {
                updateStatus(this.getStatus());
                return;
            }
    
            try {
                const $translatedImage = await this.getOperationalTranslatedImage();
    
                if (!this.origImage.isImageElement()) {
                    this._restoreBackground(this.getOriginalImage());
                    await wait(100);
                } else if (this.options.session.mode === ReplaceMode.replaceSrc) {
                    this._restoreSrc(this.getOriginalImage());
                    await waitImageLoaded(this.getOriginalImage(), 5000);
                    await wait(100); // load event could not fire
                } else {
                    this._swapImages($translatedImage, this.getOriginalImage());
                }
    
                updateStatus(ImageControllerStatuses.TRANSLATED);
    
                if (!this.origImage.isImageElement()) {
                    CustomHooks.afterBgReplace(this, this.getOriginalImage());
                } else if (this.options.session.mode === ReplaceMode.replaceSrc) {
                    CustomHooks.afterSrcReplace(this, this.getOriginalImage());
                } else {
                    CustomHooks.afterReplace(this, this.getOriginalImage(), $translatedImage);
                }
    
                this._replaced = false;
            } catch (e) {
                this.setError(e);
                updateStatus(ImageControllerStatuses.FAILED);
            }
        }
    
        isIdle() {
            return [
                ImageControllerStatuses.INIT,
            ].includes(this.getStatus());
        }
    
        isInProgress() {
            return [
                ImageControllerStatuses.PREPARING,
                ImageControllerStatuses.IN_PROGRESS,
            ].includes(this.getStatus());
        }
    
        isDone() {
            return [
                ImageControllerStatuses.TRANSLATED,
                ImageControllerStatuses.REPLACED,
                ImageControllerStatuses.CANCELED,
                ImageControllerStatuses.SKIPPED,
                ImageControllerStatuses.FAILED,
            ].includes(this.getStatus());
        }
    
        getProgress() {
            switch (true) {
                case !this._enabled:
                case this.isDone(): return ImageProgress.DONE;
                case this.isInProgress(): return ImageProgress.IN_PROGRESS;
                case this.isIdle():
                default: return ImageProgress.IDLE;
            }
        }
    
        getRecognizedText() {
            const ocrResp = this.ocrImage.ocrApi.getCachedResponse();
    
            return ocrResp &&
                ocrResp.data &&
                ocrResp.data.blocks &&
                ocrResp.data.blocks.map((block) =>
                    block.boxes.map((box) => box.text).join('\t')
                ).join('\n') || null;
        }
    
        getTranslatedText() {
            const translationApi = this.translatedImage.getUsedTranslationApi();
            const translationResp = translationApi && translationApi.getCachedResponse();
    
            return translationResp &&
                translationResp.text.map((text) =>
                    text.replace(/<wbr>/g, '\t')
                ).join('\n') || null;
        }
    
        forgetImage() {
            this.disable();
    
            this.getOriginalImage().removeAttribute('data-orig-src');
    
            this.origImage.invalidate();
    
            this._forgetHandlers.forEach((handler) => {
                try { handler() } catch (e) {}
            });
    
            // hack to restore native translation button
            this._statusHandlers.forEach((handler) => {
                try {
                    handler(ImageControllerStatuses.TRANSLATED, {
                        prevStatus: ImageControllerStatuses.REPLACED,
                        reason: ImageTranslationReasons.TARGET,
                    });
                } catch (e) {}
            });
        }
    
        /**
         * Uses local api to detect text presence on image
         * @protected
         * @throws {LocalTextDetectionError}
         * @returns {Promise<boolean>}
         */
        async _checkTextPresence() {
            if (!this.textDetectionStatus) {
                try {
                    const $img = this.origImage.getSafeImage();
    
                    this.textDetectionStatus = await ImageTranslator.getImageTextDetectionStatus($img);
                } catch (e) {
                    throw new LocalTextDetectionUnknownError();
                }
            }
    
            switch (this.textDetectionStatus) {
                case TextDetectionStatuses.SOFT_TEXT:
                case TextDetectionStatuses.STRONG_TEXT:
                    return true;
    
                case TextDetectionStatuses.NOT_IMPLEMENTED:
                    return true;
    
                case TextDetectionStatuses.NO_TEXT:
                    throw new NoTextLocalDetectionError();
    
                case TextDetectionStatuses.ERROR:
                    throw new LocalTextDetectionError();
    
                default:
                    throw new LocalTextDetectionUnknownError();
            }
        }
    
        async _safeCheckTextPresence() {
            if (this._reason === ImageTranslationReasons.QUEUE) {
                return await this._checkTextPresence();
            }
    
            // calling detect only to get status
            this._checkTextPresence().catch(x => void x);
        }
    
        _invalidateTranslation() {
            this._invalidateResultImage();
    
            this.translatedImage = new TranslatedImage(
                this.origImage, this.ocrImage, this.options, this.stats);
        }
    
        _invalidateResultImage() {
            this._$translatedImage = null;
            this._translateImagePromise = null;
            this.translatedImage.invalidateResultImage();
        }
    
        _invalidateRecognition() {
            this.ocrImage = new OcrImage(this.origImage, this.options, this.stats);
        }
    
        _removePictureSources($img) {
            const $parent = $img.parentNode;
    
            if (!$parent || $parent.nodeName !== HtmlElement.PICTURE) {
                return;
            }
    
            const $$sources = Array.from($parent.querySelectorAll('source'));
    
            for (const $source of $$sources) {
                $parent.removeChild($source);
            }
        }
    
        _swapImages($target, $newImage) {
            $target.parentNode.replaceChild($newImage, $target);
    
            ImagesWatcher.forewarnAppear($newImage);
            ImagesWatcher.forewarnDisappear($target);
        }
    
        _setElementBackground($target, $translateImage) {
            $target.style.backgroundImage = `url(${$translateImage.src})`;
        }
    
        _restoreBackground($target) {
            $target.style.backgroundImage = `url(${this.origImage.getBgOrigSrc()})`;
        }
    
        _setTranslationSrc($target, $translateImage) {
            $target.setAttribute('data-orig-src',
                $target.getAttribute('data-orig-src') || $target.src);
    
            $target.src = $translateImage.src;
        }
    
        _restoreSrc($target) {
            $target.src = $target.getAttribute('data-orig-src');
        }
    
        _trackSrc() {
            const interval = setInterval(() => {
                if (!this.isEnabled()) {
                    return;
                }
    
                const $img = this.getOperationalImage();
                let imageValid;
    
                if (this.origImage.isImageElement()) {
                    imageValid = !$img || this._ownSrcs.includes($img.src);
                } else {
                    const url = getElementBgUrl($img);
                    imageValid = !url || this._ownSrcs.includes(url);
                }
    
                if (!imageValid) {
                    this.forgetImage();
                    clearInterval(interval);
                }
            }, 1000);
        }
    
        _trackStatus() {
            this.onStatusChange(async (status, { prevStatus }) => {
                if (status === ImageControllerStatuses.TRANSLATED ||
                    status === ImageControllerStatuses.SKIPPED ||
                    status === ImageControllerStatuses.FAILED) {
                    if (prevStatus === ImageControllerStatuses.REPLACED) {
                        MetricsApi.trackImageRestore(this);
                    } else {
                        MetricsApi.trackImageDone(this);
                    }
                }
            });
        }
    
        _trackVisualProgress() {
            if (!this.options.session.enableVisualProgress) {
                return;
            }
    
            const { clientWidth = 0, clientHeight = 0 } = this.stats.getStats();
            const { minimalClientWidth, minimalClientHeight } = this.options.visualProgress;
    
            if (clientWidth < minimalClientWidth || clientHeight < minimalClientHeight) {
                return;
            }
    
            const visualProgress = new VisualProgress(this, this.options);
    
            this.onStatusChange(debounce((status, { prevStatus }) => {
                visualProgress.setTranslatedImage(this.getOperationalImage());
    
                if (status === ImageControllerStatuses.PREPARING) {
                    return;
                }
    
                if (status === ImageControllerStatuses.IN_PROGRESS) {
                    visualProgress.showProgress();
                } else if (status === ImageControllerStatuses.REPLACED) {
                    visualProgress.showSuccess();
                } else if (status === ImageControllerStatuses.TRANSLATED &&
                    prevStatus === ImageControllerStatuses.IN_PROGRESS) {
                } else { // .FAIL or .TRANSLATED
                    visualProgress.hide();
                }
            }));
        }
    
        _getTextOverlay() {
            if (!this._textOverlay) {
                this._textOverlay = new TextOverlay(this, this.options, this.stats);
            }
    
            return this._textOverlay;
        }
    
        _trackTextOverlay() {
            if (!this.options.session.enableTextPopup) {
                return;
            }
    
            this.onStatusChange((status) => {
                if (status === ImageControllerStatuses.REPLACED) {
                    setTimeout(() => this._updateTextOverlay(), 0);
                } else {
                    this._disableTextOverlay();
                }
            });
        }
    
        _trackTranslatedImage($trImg) {
            if (!this.options.session.enableTextPopup || !$trImg || !this.origImage.isImageElement()) {
                return;
            }
    
            const options = this.options.textOverlayOptions;
            const textOverlay = this._getTextOverlay();
    
            const listenBoundChange = () => {
                const listenerInterval = options.showOnHover ?
                    options.boundListenerActiveInterval :
                    options.boundListenerCommonInterval;
    
                this._stopBoundListener = HtmlElement.onBoundChange($trImg, async () => {
                    if (!this._enabled) {
                        stopListeningBoundChange();
                    } else if ($trImg === this.getOperationalImage()) {
                        textOverlay.updateOverlayPosition();
                    }
                }, listenerInterval);
            };
    
            const stopListeningBoundChange = () => {
                if (this._stopBoundListener) {
                    this._stopBoundListener();
                    this._stopBoundListener = null;
                }
            };
    
            const showOverlay = () => {
                textOverlay.setShowed(true);
                textOverlay.updateOverlayPosition();
            }
    
            stopListeningBoundChange();
    
            textOverlay.onVisibilityChange((visible) => {
                if (!this._enabled) {
                    return;
                }
                if (visible) {
                    stopListeningBoundChange();
                    listenBoundChange();
                } else {
                    stopListeningBoundChange();
                }
            });
    
            if (options.showOnHover) {
                let _hoverOnPath = false;
    
                const onMouseEnter = () => {
                    if (!_hoverOnPath) {
                        showOverlay();
                    }
                    _hoverOnPath = false;
                };
    
                const onMouseMove = () => {
                    if (!textOverlay.overlayShowed) {
                        showOverlay();
                    }
                };
    
                const onMouseLeave = (e) => {
                    if (e.relatedTarget && e.relatedTarget.hasAttribute('data-path-id')) {
                        _hoverOnPath = true;
                        return;
                    }
                    _hoverOnPath = false;
                    textOverlay.setShowed(false);
                };
    
                $trImg.addEventListener('mouseenter', onMouseEnter);
                $trImg.addEventListener('mousemove', onMouseMove);
                $trImg.addEventListener('mouseleave', onMouseLeave);
    
                this.onForget(() => {
                    stopListeningBoundChange();
                    $trImg.removeEventListener('mouseenter', onMouseEnter);
                    $trImg.removeEventListener('mousemove', onMouseMove);
                    $trImg.removeEventListener('mouseleave', onMouseLeave);
                });
            }
        }
    
        async _updateTextOverlay() {
            if (!this._enabled || !this.getOperationalImage()) {
                return;
            }
    
            const textOverlay = this._getTextOverlay();
            const overlaySvg = await this._getOverlaySvg();
    
            if (!overlaySvg) {
                return;
            }
    
            textOverlay.setEnabled(true);
    
            if (!this.options.textOverlayOptions.showOnHover) {
                textOverlay.setShowed(true);
            }
    
            textOverlay.updateOverlay(this.getOperationalImage(), overlaySvg);
        }
    
        _disableTextOverlay() {
            this._getTextOverlay().setEnabled(false);
        }
    
        /**
         * @param {HTMLImageElement} $image
         * @returns {boolean}
         */
        static isTranslatedImage($image) {
            return this._$$translatedImages.includes($image);
        }
    
        /**
         * @param {HTMLImageElement} $image
         * @returns {boolean}
         */
        static isOriginalImage($image) {
            return !this.isTranslatedImage($image);
        }
    }
    
    class Api {
        _reconnects = 0;
    
        getSid() {
            return this.options.session.sid;
        }
    
        getId(count) {
            return [this.stats.id, count, this._reconnects++].join('-');
        }
    
        static generateSid() {
            let sid = Date.now().toString(16);
    
            for (let i = 0, n = 16 - sid.length; i < n; i++) {
                sid += Math.floor(Math.random() * 16).toString(16);
            }
    
            return sid;
        }
    }
    
    class MetricsApi {
        static _count = 0;
    
        /**
         * @param {SessionOptions} options
         */
        constructor(options) {
            this.options = options;
        }
    
        /**
         * @param {String} cid
         * @param {String} path
         * @param {Object} params
         * @returns {Promise}
         */
        async send(cid, path, params) {
            const img = new Image();
    
            return new Promise((resolve) => {
                img.onload = resolve;
                img.src = this._makeUrl(cid, path, params);
            });
        }
    
        _makeUrl(cid, path, params) {
            const _c = MetricsApi._count++;
            const { pid, dtype } = this.options.clckOptions;
    
            const urlParams = {
                dtype, pid, cid, path, _c,
                ...this._prepareParams(params)
            };
    
            return this.options.clckUrl + this._joinParams(urlParams) + '/*';
        }
    
        _prepareParams(params) {
            const { keyPrefix, maxDataLen } = this.options.clckOptions;
    
            return Object.fromEntries(
                Object.entries(params).map(([key, value]) => [
                    keyPrefix + key, String(value).slice(0, maxDataLen)
                ])
            );
        }
    
        _joinParams(params) {
            return Object.entries(params).map(([key, value]) =>
                encodeURIComponent(key) +
                    (value === null ? '' : '=' + encodeURIComponent(String(value)))
            ).join('/');
        }
    
        static _inlineError(error) {
            if (error.originalError) {
                return `${error.name}<${error.originalError.name}>`;
            }
    
            return error.name;
        }
    
        static _inlineBenchmarks(benchmarks) {
            return Object.entries(benchmarks).map(([key, value]) => {
                return [key, value === null ? '' : Math.round(value)].join(':')
            }).join(';');
        }
    
        static _inlineImageSizes = (stats) => {
            return [
                `${stats.origWidth},${stats.origHeight}`,
                `${stats.clientWidth},${stats.clientHeight}`
            ].join(';');
        }
    
        static _inlineLangPair = async (session, ocrImage) => {
            const detectedLang = session.srcAutodetect ?
                await ocrImage.getDetectedLang() : null;
    
            return [detectedLang || session.srcLang, session.dstLang].join('-');
        }
    
        /**
         * @param {ImageController} imgCtrl
         */
        static async trackImageDone(imgCtrl) {
            const { stats, options, ocrImage, origImage } = imgCtrl;
            const { session } = options;
    
            const api = new MetricsApi(options);
            const error = imgCtrl.getError();
            const cid = options.clckCounters.imageDone;
            const $orig = origImage.getElement();
            const path = error ? 'image.translation.error' : 'image.translation.done';
            const { trackApiResponse } = options.clckOptions;
    
            return api.send(cid, path, {
                id: imgCtrl.stats.id,
                sid: session.sid,
                error: error ? this._inlineError(error) : null,
                src: $orig ? $orig.src || $orig.getAttribute('src') : null,
                lang: await this._inlineLangPair(session, ocrImage),
                auto: session.srcAutodetect ? 1 : 0,
                reason: imgCtrl._reason,
                timings: this._inlineBenchmarks(stats.getBenchmarkStats()),
                img_size: this._inlineImageSizes(stats.getStatsMap()),
                recognized: trackApiResponse ? imgCtrl.getRecognizedText() : null,
                translated: trackApiResponse ? imgCtrl.getTranslatedText() : null,
                detection_status: imgCtrl.textDetectionStatus,
            });
        }
    
        /**
         * @param {ImageController} imgCtrl
         */
        static async trackImageRestore(imgCtrl) {
            const { options } = imgCtrl;
            const { session } = options;
    
            const api = new MetricsApi(options);
            const error = imgCtrl.getError();
            const cid = options.clckCounters.imageRestored;
            const path = error ? 'image.restoring.error' : 'image.restoring.done';
    
            return api.send(cid, path, {
                id: imgCtrl.stats.id,
                sid: session.sid,
                error: error ? this._inlineError(error) : null,
                reason: imgCtrl._reason,
            });
        }
    }
    
    class OcrApi extends Api {
        static _requestsCount = 0;
        static _requestTimestamps = [];
    
        _response;
        _activeRequest;
    
        static STATUS_SUCCESS = 'success';
        static LANG_AUTODETECT = '*';
    
        /**
         * @param {OcrImage} ocrImage
         * @param {SessionOptions} options
         * @param {ImageStats} stats
         */
        constructor(ocrImage, options, stats) {
            super();
            this.ocrImage = ocrImage;
            this.options = options;
            this.stats = stats;
        }
    
        async getDetectedLang() {
            return this._response &&
                this._response.data &&
                this._response.data.detected_lang || null;
        }
    
        getCachedResponse() {
            return this._response;
        }
    
        async recognize() {
            if (this._response) {
                return this._response;
            } else if (this._activeRequest) {
                return this._activeRequest;
            }
    
            const slowdownTimeout = this.getSlowdownTimeout();
    
            OcrApi._requestTimestamps.push(Date.now());
    
            if (slowdownTimeout) {
                await wait(slowdownTimeout);
            }
    
            const { srcAutodetect, srcLang, ocrSrv } = this.options.session;
            const lang = srcAutodetect ? OcrApi.LANG_AUTODETECT : srcLang;
    
            const url = makeUrl(this.options.ocrApiUrl, {
                lang,
                id: this.getId(OcrApi._requestsCount++),
                sid: this.getSid(),
                srv: ocrSrv,
            });
    
            const file = await this.ocrImage.getImageBlob();
    
            this._activeRequest = new Promise((resolve, reject) => {
                const stop$ = this.stats.start$(ImageStats.benchmarks.ocrApi);
    
                return fetchWithTimeout(url, {
                    method: 'POST',
                    body: formData({ file })
                })
                    .then((response) => {
                        if (response.status !== 200) {
                            return Promise.reject(new RecognitionError());
                        }
                        return response.json();
                    })
                    .then((response) => {
                        if (!response || response.status !== OcrApi.STATUS_SUCCESS) {
                            return Promise.reject(new RecognitionError());
                        } else if (!response.data || !response.data.blocks.length) {
                            return Promise.reject(new NoTextError());
                        }
                        return response;
                    })
                    .then((response) => {
                        this._response = response;
                        resolve(response);
                    })
                    .catch((e) => {
                        if (e instanceof ImageTranslationError) {
                            reject(e);
                        } else {
                            reject(new RecognitionError(e));
                        }
                    })
                    .finally(() => {
                        stop$();
                        this._activeRequest = null;
                    })
            });
    
            this._activeRequest
                .catch((e) => {})
                .finally(() => {
                    this._activeRequest = null;
                });
    
            return this._activeRequest;
        }
    
        getSlowdownTimeout() {
            const { requestsLimit, periodDuration, timeoutCoef } = this.options.ocrSlowdown;
            const periodStart = Date.now() - periodDuration;
            const requestsPerPeriod = OcrApi._requestTimestamps
                .filter((ts) => ts > periodStart).length;
    
            return requestsPerPeriod > requestsLimit ?
                timeoutCoef * (requestsPerPeriod - requestsLimit) : 0;
        }
    }
    
    class TranslationApi extends Api {
        static _requestsCount = 0;
    
        _response;
        _activeRequest;
    
        static FORMAT_HTML = 'html';
    
        /**
         * @param {Array<String>} texts
         * @param {SessionOptions} options
         * @param {ImageStats} stats
         */
        constructor(texts, options, stats) {
            super();
            this.texts = texts;
            this.options = options;
            this.stats = stats;
        }
    
        getCachedResponse() {
            return this._response;
        }
    
        async translate(overrideSrcLang = null) {
            if (this._response) {
                return this._response;
            } else if (this._activeRequest) {
                return this._activeRequest;
            }
    
            const { srcLang, dstLang, trnslSrv } = this.options.session;
    
            const url = makeUrl(this.options.translationApiUrl, {
                srv: trnslSrv,
                reason: 'ocr',
                id: this.getId(TranslationApi._requestsCount++),
                sid: this.getSid(),
                lang: [overrideSrcLang || srcLang, dstLang].join('-'),
                format: TranslationApi.FORMAT_HTML,
            });
    
            const params = new URLSearchParams({ options: '0' });
    
            this.texts.forEach((text) => params.append('text', text));
    
            this._activeRequest = new Promise((resolve, reject) => {
                const stop$ = this.stats.start$(ImageStats.benchmarks.translationApi);
    
                return fetchWithTimeout(url, {
                    method: 'POST',
                    body: params,
                })
                    .then((response) => {
                        if (response.status !== 200) {
                            return Promise.reject(new TranslationError());
                        }
                        return response.json();
                    })
                    .then((response) => {
                        this._response = response;
                        resolve(response);
                    })
                    .catch((e) => {
                        if (e instanceof ImageTranslationError) {
                            reject(e);
                        } else {
                            reject(new TranslationError(e));
                        }
                    })
                    .finally(() => {
                        stop$();
                        this._activeRequest = null;
                    });
            });
    
            this._activeRequest
                .catch((e) => {})
                .finally(() => {
                    this._activeRequest = null;
                });
    
            return this._activeRequest;
        }
    }
    
    class HtmlElement {
        static YTR_SRC = 'ytrSrc';
        static YTR_ORIG_SRC = 'ytrOrigSrc';
        static $YTR_LINKED_IMG = '$ytrLinkedImg';
    
        static TRANSLATE_ATTR = 'translate';
        static TRANSLATE_NO = 'no';
    
        static PICTURE = 'PICTURE';
        static YTR_CONTAINER_EL = 'ytr-container';
    
        static _$container;
    
        static getContainerElement() {
            if (!this._$container) {
                this._$container = doc.createElement(this.YTR_CONTAINER_EL);
    
                doc.documentElement.appendChild(this._$container);
            }
            return this._$container;
        }
    
        /**
         * @param {HTMLElement} $el
         * @returns {Boolean}
         */
        static isElementTranslationAllowed($el) {
            const attr = this.TRANSLATE_ATTR;
    
            let $current = $el;
    
            while ($current && $current instanceof Element) {
                if ($current.hasAttribute(attr)) {
                    return $current.getAttribute(attr) !== this.TRANSLATE_NO;
                }
    
                $current = $current.parentNode;
            }
    
            return Boolean($current);
        }
    
        /**
         * @param {HTMLElement} $el
         * @returns {String}
         */
        static getBgSrc($el) {
            if (!(HtmlElement.YTR_SRC in $el)) {
                $el[HtmlElement.YTR_SRC] = null;
    
                const bgUrl = getElementBgUrl($el);
    
                if (bgUrl) {
                    $el[HtmlElement.YTR_SRC] = normalizeUrl(bgUrl);
                    $el[HtmlElement.YTR_ORIG_SRC] = bgUrl;
                }
            }
    
            return $el[HtmlElement.YTR_SRC];
        }
    
        /**
         * @param {HTMLElement} $el
         * @returns {Boolean}
         */
        static isImageElement($el) {
            return $el instanceof HTMLImageElement;
        }
    
        /**
         * @param {HTMLElement} $el
         * @returns {Boolean}
         */
        static isElementWithBgImage($el) {
            return Boolean(
                $el &&
                $el.tagName &&
                $el.tagName.toLowerCase() === 'div' &&
                !$el.childElementCount &&
                this.getBgSrc($el)
            );
        }
    
        /**
         * @param {HTMLElement} $el
         * @returns {Boolean}
         */
        static isImageLikeElement($el) {
            return this.isImageElement($el) || this.isElementWithBgImage($el);
        }
    
        /**
         * @param {HTMLElement|HTMLImageElement} $image
         * @returns {Boolean}
         */
        static isElementTranslatable($image) {
            return this.isImageLikeElement($image) && this.isElementTranslationAllowed($image);
        }
    
        /**
         * @param {HTMLElement} $el
         * @param {Number=1} viewportScaleRatio
         * @returns {Boolean}
         */
        static isElementInViewport($el, viewportScaleRatio = 1) {
            return this.isRectInViewport($el.getBoundingClientRect(), viewportScaleRatio);
        }
    
        /**
         * @param {HTMLElement} $el
         * @returns {Number}
         */
        static getElementVisibleArea($el) {
            return this.getRectVisibleArea($el.getBoundingClientRect());
        }
    
        /**
         * @param {DOMRect} rect
         * @param {Number=1} viewportScaleRatio
         * @returns {Boolean}
         */
        static isRectInViewport(rect, viewportScaleRatio = 1) {
            const $doc = doc.documentElement;
            const viewportWidth = (win.innerWidth || $doc.clientWidth) * viewportScaleRatio;
            const viewportHeight = (win.innerHeight || $doc.clientHeight) * viewportScaleRatio;
    
            return rect.bottom > 0 && rect.right > 0 &&
                rect.left < viewportWidth && rect.top < viewportHeight;
        }
    
        /**
         * @param {DOMRect} rect
         * @returns {Number}
         */
        static getRectVisibleArea(rect) {
            const $doc = doc.documentElement;
            const viewportWidth = win.innerWidth || $doc.clientWidth;
            const viewportHeight = win.innerHeight || $doc.clientHeight;
    
            const left = Math.max(0, rect.left);
            const top = Math.max(0, rect.top);
            const right = Math.min(viewportWidth, rect.right);
            const bottom = Math.min(viewportHeight, rect.bottom);
    
            const width = right - left;
            const height = bottom - top;
    
            if (width > 0 && height > 0) {
                return width * height;
            }
    
            return 0;
        }
    
        /**
         * @param {HTMLElement} $el
         * @param {Function} callback
         * @param {Number=} interval
         * @returns {Function} handler terminator
         */
        static onBoundChange($el, callback, interval = 500) {
            let _interval;
            let prevRect = this.getAbsRect($el);
    
            const hasRectChanged = (rect) => {
                if (!prevRect || !rect) {
                    return false;
                }
    
                return rect.width !== prevRect.width ||
                    rect.height !== prevRect.height ||
                    Math.ceil(rect.x) !== Math.ceil(prevRect.x) ||
                    Math.ceil(rect.y) !== Math.ceil(prevRect.y);
            }
    
            _interval = setInterval(() => {
                const rect = $el && this.getAbsRect($el);
    
                if (hasRectChanged(rect)) {
                    callback(rect);
                }
    
                prevRect = rect;
            }, interval);
    
            return () => clearInterval(_interval);
        }
    
        /**
         * @param {HTMLElement} $el
         * @returns {Object}
         */
        static getAbsRect($el) {
            const rect = $el.getBoundingClientRect();
    
            return {
                x: rect.left + win.pageXOffset,
                y: rect.top + win.pageYOffset,
                width: $el.clientWidth,
                height: $el.clientHeight,
            }
        }
    
        static htmlToEl(html) {
            const el = doc.createElement('div');
            el.innerHTML = html;
            return el.firstElementChild;
        }
    
    
        static setStyles($el, styles) {
            for (const key in styles) {
                if (styles.hasOwnProperty(key)) {
                    $el.style[key] = styles[key];
                }
            }
        }
    }
    
    class OrigImage extends HtmlElement {
        /**
         * @param {HTMLElement} $image
         * @param {HTMLImageElement=} $safeImage
         * @param {SessionOptions} options
         * @param {ImageStats} stats
         */
        constructor($image, $safeImage = null, options, stats) {
            super();
            this.$image = $image;
            this.$safeImage = $safeImage || $image;
            this.options = options;
            this.stats = stats;
            this._updateStats();
        }
    
        invalidate() {
            delete this.$image[OrigImage.YTR_SRC];
            delete this.$image[OrigImage.YTR_ORIG_SRC];
            delete this.$image[OrigImage.$YTR_LINKED_IMG];
        }
    
        /**
         * @returns {HTMLElement} original element
         */
        getElement() {
            return this.$image;
        }
    
        /**
         * @returns {HTMLImageElement} same origin image
         */
        getSafeImage() {
            return this.$safeImage;
        }
    
        getImageSrc() {
            return this.$safeImage.src;
        }
    
        isImageElement() {
            return HtmlElement.isImageElement(this.$image);
        }
    
        getBgSrc() {
            return this.$image[OrigImage.YTR_SRC];
        }
    
        getBgOrigSrc() {
            return this.$image[OrigImage.YTR_ORIG_SRC];
        }
    
        getSizes() {
            return {
                width: this.$safeImage.naturalWidth,
                height: this.$safeImage.naturalHeight,
            };
        }
    
        getClientSizes() {
            return {
                width: this.$image.clientWidth,
                height: this.$image.clientHeight,
            };
        }
    
        hasValidFormat() {
            return true;
        }
    
        hasValidSizes() {
            return true;
        }
    
        isInViewport() {
            return HtmlElement.isElementInViewport(
                this.getElement(), this.options.session.viewportPreloadScreens);
        }
    
        _updateStats() {
            const orig = this.getSizes();
            const client = this.getClientSizes();
    
            this.stats.setStat(ImageStats.statKeys.origWidth, orig.width);
            this.stats.setStat(ImageStats.statKeys.origHeight, orig.height);
    
            this.stats.setStat(ImageStats.statKeys.clientWidth, client.width);
            this.stats.setStat(ImageStats.statKeys.clientHeight, client.height);
        }
    
        static ensureLinkedImgForImageLikeElement($el) {
            if ($el[OrigImage.$YTR_LINKED_IMG]) {
                return;
            }
    
            const src = HtmlElement.getBgSrc($el);
            const $img = new Image();
    
            $img.crossOrigin = 'anonymous';
            $img.src = src;
    
            $el[OrigImage.$YTR_LINKED_IMG] = $img;
        }
    
        /**
         * @param {HTMLImageElement} $image
         * @param {SessionOptions} options
         * @param {ImageStats} stats
         */
        static async fromImageElement($image, options, stats) {
            await waitImageLoaded($image);
    
            const stop$ = stats.start$(ImageStats.benchmarks.preparation);
    
            if (!OrigImage.checkNaturalSizes($image, options)) {
                throw new ImageSizeError();
            }
    
            let $safeImage; // with origin-clean flag
    
            if (this._checkCorsFlag($image)) {
                $safeImage = $image;
            } else {
                $safeImage = new Image();
                $safeImage.crossOrigin = 'anonymous';
                $safeImage.src = $image.src;
                await waitImageLoaded($safeImage);
            }
    
            const origImage = new OrigImage($image, $safeImage, options, stats);
    
            stop$();
    
            return origImage;
        }
    
        /**
         * @param {HTMLElement} $el
         * @param {SessionOptions} options
         * @param {ImageStats} stats
         */
        static async fromImageLikeElement($el, options, stats) {
            this.ensureLinkedImgForImageLikeElement($el);
            const $image = $el[OrigImage.$YTR_LINKED_IMG];
    
            await waitImageLoaded($image);
            await wait(0);
    
            const stop$ = stats.start$(ImageStats.benchmarks.preparation);
    
            if (!OrigImage.checkNaturalSizes($image, options)) {
                throw new ImageSizeError();
            }
    
            const origImage = new OrigImage($el, $image, options, stats);
    
            stop$();
    
            return origImage;
        }
    
        /**
         * @param {HTMLImageElement} $image
         * @param {SessionOptions|MainImageTrackerOptions} options
         * @return {Boolean}
         */
        static checkNaturalSizes($image, options) {
            return $image.naturalWidth >= options.minimalWidth &&
                $image.naturalHeight >= options.minimalHeight;
        }
    
        /**
         * @param {HTMLImageElement} $image
         * @param {SessionOptions|MainImageTrackerOptions} options
         * @return {Boolean}
         */
        static checkClientSizes($image, options) {
            return $image.clientWidth >= options.minimalWidth &&
                $image.clientHeight >= options.minimalHeight;
        }
    
        /**
         * @param {HTMLImageElement} $image
         * @return {Boolean}
         */
        static _checkCorsFlag($image) {
            const $canvas = CanvasImage.createCanvasElement();
            const ctx = $canvas.getContext('2d');
    
            $canvas.width = 1;
            $canvas.height = 1;
    
            try {
                CanvasImage.drawImage($canvas, $image, 0, 0, 1, 1);
                ctx.getImageData(0, 0, 1, 1);
                return true;
            } catch (e) {
                return false;
            }
        }
    }
    
    class OcrImage extends CanvasImage {
        _blob;
        _$resizedOrigCanvas;
    
        /**
         * @param {OrigImage} origImage
         * @param {SessionOptions} options
         * @param {ImageStats} stats
         */
        constructor(origImage, options, stats) {
            super();
            this.hasAlphaChannel = false;
            this.origImage = origImage;
            this.options = options;
            this.ocrApi = new OcrApi(this, options, stats);
            this.stats = stats;
        }
    
        async recognize() {
            return (await this.ocrApi.recognize()).data;
        }
    
        async getDetectedLang() {
            return await this.ocrApi.getDetectedLang();
        }
    
        /**
         * @returns {Promise<Blob>}
         */
        async getImageBlob() {
            return new Promise((resolve) => {
                if (this._blob) {
                    return resolve(this._blob);
                }
    
                const stop$ = this.stats.start$(ImageStats.benchmarks.ocrBlob);
    
                this.getCanvas().toBlob((blob) => {
                    this.stats.setStat(ImageStats.statKeys.ocrSize, blob.size);
    
                    stop$();
    
                    this._blob = blob;
    
                    resolve(blob);
                },
                    this.options.imageFormat,
                    this.options.imageQuality);
            });
        }
    
        /**
         * @desc Used to pick colors
         * @returns {HTMLCanvasElement} resized orig image
         */
        getResizedOrigCanvas() {
            if (!this._$resizedOrigCanvas) {
                const stop$ = this.stats.start$(ImageStats.benchmarks.ocrResize);
                this._$resizedOrigCanvas = this._makeResizedOrigCanvas();
                stop$();
            }
            return this._$resizedOrigCanvas;
        }
    
        /**
         * @param {int} x
         * @param {int} y
         * @returns {Color}
         */
        pickColor(x, y) {
            const useCache = isFirefox();
            const $canvas = this.getResizedOrigCanvas();
            const ctx = $canvas.getContext('2d');
    
            if (useCache) { // cache can reduce function time up to 10 times
                const { width, height } = $canvas;
                const pixelDataLength = 4; // [r g b a]
                const imageDataOffset = (y * width + x) * pixelDataLength;
    
                if (!this._imageData) {
                    this._imageData = ctx.getImageData(0, 0, width, height).data;
                }
    
                return Color.fromImageData(this._imageData
                    .slice(imageDataOffset, imageDataOffset + pixelDataLength));
            } else {
                return Color.fromImageData(ctx.getImageData(x, y, 1, 1).data);
            }
        }
    
        clearImageDataCache() {
            if (this._imageData) {
                this._imageData = null;
            }
        }
    
        _makeResizedOrigCanvas() {
            const $image = this.origImage.getSafeImage();
            const { naturalWidth, naturalHeight } = $image;
    
            const ratio = Math.sqrt(naturalHeight * naturalWidth
                / this.options.imageMaxSideSize ** 2);
            const scale = ratio > 1 ? 1 / ratio : 1;
    
            const $canvas = CanvasImage.createCanvasElement();
    
            $canvas.width = $image.naturalWidth * scale;
            $canvas.height = $image.naturalHeight * scale;
    
            this.stats.setStat(ImageStats.statKeys.ocrWidth, $canvas.width);
            this.stats.setStat(ImageStats.statKeys.ocrHeight, $canvas.height);
    
            CanvasImage.drawImage($canvas, $image, 0, 0, $canvas.width, $canvas.height);
    
            return $canvas;
        }
    
        _makeCanvas() {
            const $resizedOrigCanvas = this.getResizedOrigCanvas();
            const $canvas = CanvasImage.createCanvasElement();
            const stop$ = this.stats.start$(ImageStats.benchmarks.ocrPatch);
    
            $canvas.width = $resizedOrigCanvas.width;
            $canvas.height = $resizedOrigCanvas.height;
    
            CanvasImage.drawImage($canvas,
                $resizedOrigCanvas, 0, 0, $canvas.width, $canvas.height);
            this._patchOcrCanvas($canvas, this.options);
    
            stop$();
    
            return $canvas;
        }
    
        _patchOcrCanvas($canvas) {
            const {
                transparencyBorder,
                minimalTransparentArea
            } = this.options.transparencyFillingOptions;
    
            const ctx = $canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, $canvas.width, $canvas.height);
            const data = imageData.data;
    
            let transparentPixels = 0;
            let filledPixels = 0;
            let lightnessSum = 0;
    
            for (let i = 0; i < data.length; i += 4) {
                const lightness = OcrImage.rgbToLightness(data[i], data[i + 1], data[i + 2]);
    
                if (this.options.useGrayscaleFilter) {
                    data[i] = lightness;
                    data[i + 1] = lightness;
                    data[i + 2] = lightness;
                }
    
                if (data[i + 3] < transparencyBorder) {
                    transparentPixels += 1;
                } else {
                    filledPixels += 1;
                    lightnessSum += lightness;
                }
            }
    
            const transparentArea = transparentPixels / (transparentPixels + filledPixels);
    
            if (this.options.fillTransparentImages && transparentArea > minimalTransparentArea) {
                this.hasAlphaChannel = true;
    
                const avgLightness = lightnessSum / filledPixels;
                const fillingLightness = avgLightness > 128 ? avgLightness - 64 : avgLightness + 64;
    
                for (let i = 0; i < data.length; i += 4) {
                    if (data[i + 3] >= transparencyBorder) {
                        data[i + 3] = 256;
                        continue;
                    }
    
                    data[i] = fillingLightness;
                    data[i + 1] = fillingLightness;
                    data[i + 2] = fillingLightness;
                    data[i + 3] = 256;
                }
            }
    
            ctx.putImageData(imageData, 0, 0);
        }
    
        static rgbToLightness(r, g, b) {
            // return parseInt((r + g + b) / 3);
            // return Math.round(r * 0.299 + g * 0.587 + b * 0.114);
            return parseInt(3 * r + 4 * g + b >>> 3);
        }
    }
    
    class TranslatedImage extends CanvasImage {
        _$image;
        _$canvasImage;
    
        /** @type {TranslationApi} */
        _translationApi;
        _translatedBlocks;
        _svgImage;
    
        _objectUrl;
        _dataUrl;
    
        replaced = false;
    
        /**
         * @param {OrigImage} origImage
         * @param {OcrImage} ocrImage
         * @param {SessionOptions} options
         * @param {ImageStats} stats
         */
        constructor(origImage, ocrImage, options, stats) {
            super();
            this.origImage = origImage;
            this.ocrImage = ocrImage;
            this.options = options;
            this.stats = stats;
        }
    
        async getOcrBlocks() {
            return (await this.ocrImage.recognize()).blocks;
        }
    
        invalidateResultImage() {
            this._$image = null;
            this._$canvasImage = null;
            this._translatedBlocks = null;
            this._svgImage = null;
            this._dataUrl = null;
    
            this.stats.invalidateSum();
    
            if (this._objectUrl) {
                win.URL.revokeObjectURL(this._objectUrl);
                this._objectUrl = null;
            }
        }
    
        getUsedTranslationApi() {
            return this._translationApi;
        }
    
        /**
         * @returns {Promise<TranslationApi>}
         */
        async getTranslationApi() {
            if (!this._translationApi) {
                const blocks = await this.getOcrBlocks();
    
                const textBlocks = blocks.map((block) =>
                    block.boxes.map((box) => box.text).join(' <wbr> '));
    
                this._translationApi = new TranslationApi(
                    textBlocks, this.options, this.stats);
            }
    
            return this._translationApi;
        }
    
        /**
         * @return {Promise<SvgImage>}
         */
        async getSvgImage() {
            if (!this._svgImage) {
                const blocks = await this.getTranslatedBlocks();
    
                this._svgImage = new SvgImage(
                    blocks, this.origImage, this.ocrImage, this.options, this.stats);
            }
            return this._svgImage;
        }
    
        async getTranslatedBlocks() {
            if (this._translatedBlocks) {
                return this._translatedBlocks;
            }
    
            let blocks = await this.getOcrBlocks();
    
            const translation = await this._getBlocksTranslation();
    
            translation.text.forEach((block, i) => {
                block.split(/\s?<\s?wbr\s?>\s?/gi).forEach((box, k) => {
                    if (blocks[i] && blocks[i].boxes[k]) {
                        blocks[i].boxes[k].translation = box.trim();
                    }
                })
            });
    
            if (this.options.skipSameTranslatedBlocks) {
                blocks = blocks.filter((block) => {
                    const text = block.boxes.map((b) => b.text).join(' ');
                    const translation = block.boxes.map((b) => b.translation).join(' ');
                    return !text || !translation || text.toLowerCase() !== translation.toLowerCase();
                });
            }
    
            if (!blocks.length) {
                throw new TranslationIsSameError();
            }
    
            this._translatedBlocks = blocks;
    
            return blocks;
        }
    
        async getImage() {
            if (!this._$image) {
                this._$image = await this._makeImage();
            }
            return this._$image;
        }
    
        async getOverlaySvg() {
            const svgImage = await this.getSvgImage();
    
            return svgImage.getOverlaySvg();
        }
    
        getResultedImageSrc() {
            return this.options.result.useBlobObjectUrl ?
                this._objectUrl : this._dataUrl;
        }
    
        async _makeImage() {
            const svgImage = await this.getSvgImage();
            const $svgImage = await svgImage.getAsImage();
            const { transparencyPatches } = svgImage.getSvgData();
    
            const stop$ = this.stats.start$(ImageStats.benchmarks.resultImage)
    
            this._applyTransparentPatches(transparencyPatches);
            this._drawImageOnCanvas($svgImage);
            const $image = await this.getCanvasAsImage();
            this._addOrigImageAttrs($image);
    
            stop$();
    
            return $image;
        }
    
        _addOrigImageAttrs($image) {
            const skipAttrs = ['src', 'srcset'];
            const $orig = this.origImage.getElement();
    
            $orig.getAttributeNames().forEach((attr) => {
                if (!skipAttrs.includes(attr)) {
                    try {
                        $image.setAttribute(attr, $orig.getAttribute(attr));
                    } catch (e) {}
                }
            });
    
            return $image;
        }
    
        async getCanvasAsImage() {
            if (!this._$canvasImage) {
                this._$canvasImage = await this._getCanvasAsImage();
            }
            return this._$canvasImage;
        }
    
        async _getCanvasAsImage() {
            const $canvas = this.getCanvas();
            const $image = doc.createElement('img');
    
            if (this._objectUrl) {
                win.URL.revokeObjectURL(this._objectUrl);
            }
    
            return new Promise((resolve, reject) => {
                $image.onload = function() {
                    resolve($image);
                };
    
                $image.onerror = (e) => {
                    reject(new ProcessingError(e))
                };
    
                if (this.options.result.useBlobObjectUrl) {
                    $canvas.toBlob((blob) => {
                        this._objectUrl = win.URL.createObjectURL(blob);
                        $image.src = this._objectUrl;
                    }, this._getTargetFileType());
                } else {
                    this._dataUrl = $canvas.toDataURL(this._getTargetFileType());
                    $image.src = this._dataUrl;
                }
    
                this.stats.setStat(ImageStats.statKeys.resSize,
                    Math.round($image.src.length * 3 / 4));
            });
        }
    
        _getTargetFileType() {
            if (this.ocrImage.hasAlphaChannel) {
                return ImageFileType.PNG;
            } else {
                return this.options.result.preferableFormat;
            }
        }
    
        async _getBlocksTranslation() {
            const api = await this.getTranslationApi();
            const overrideSrcLang = this.options.session.srcAutodetect ?
                await this.ocrImage.getDetectedLang() : null;
    
            return await api.translate(overrideSrcLang);
        }
    
        _makeCanvas() {
            const $image = this.origImage.getSafeImage();
            const $canvas = CanvasImage.createCanvasElement();
    
            $canvas.width = $image.naturalWidth;
            $canvas.height = $image.naturalHeight;
    
            CanvasImage.drawImage($canvas, $image, 0, 0, $canvas.width, $canvas.height);
    
            return $canvas;
        }
    
        _applyTransparentPatches(patches) {
            if (patches.length && this.options.result.enableTransparencyPatching) {
                const ctx = this.getCanvasCtx();
    
                patches.forEach(({ w, h, x, y }) => {
                    ctx.clearRect(x, y, w, h);
                });
            }
        }
    }
    
    class ItemsStore {
        static _paths = {};
        static _blocks = {};
    
        static addPath(path) {
            this._paths[path.pathId] = path;
        }
    
        static addBlock(block) {
            this._blocks[block.blockId] = block;
        }
    
        static getPath(pathId) {
            return this._paths[pathId];
        }
    
        static getBlock(blockId) {
            return this._blocks[blockId];
        }
    }
    
    class SvgImage {
        static pathCounter = 0;
        static blockCounter = 0;
    
        _$image;
        _svg;
        _data;
    
        /**
         * @param {Array<Object>} blocks
         * @param {OrigImage} origImage
         * @param {OcrImage} ocrImage
         * @param {SessionOptions} options
         * @param {ImageStats} stats
         */
        constructor(blocks, origImage, ocrImage, options, stats) {
            this.blocks = blocks;
            this.origImage = origImage;
            this.ocrImage = ocrImage;
            this.options = options;
            this.stats = stats;
        }
    
        async getAsImage() {
            if (!this._$image) {
                this._$image = await this._getAsImage();
            }
            return this._$image;
        }
    
        async _getAsImage() {
            const { width, height } = this.origImage.getSizes();
            const svg = this.getSvg();
            const stop$ = this.stats.start$(ImageStats.benchmarks.svgImage);
            const $image = new Image(width, height);
            const image64 = SvgImage.svgStringToBase64(svg, width, height);
    
            return new Promise((resolve, reject) => {
                $image.onload = function() {
                    stop$();
                    resolve($image);
                };
    
                $image.onerror = (e) => {
                    stop$();
                    reject(new ProcessingError(e))
                };
    
                $image.src = image64;
            });
        }
    
        getSvg() {
            if (!this._svg) {
                const stop$ = this.stats.start$(ImageStats.benchmarks.svgContent);
                this._svg = this._getSvg();
                stop$();
            }
            return this._svg;
        }
    
        getOverlaySvg() {
            if (!this._overlaySvg) {
                this._overlaySvg = this._getTextOverlaySvg();
            }
            return this._overlaySvg;
        }
    
        findColorByPoints(points) {
            const colors = points.map(({ x, y }) => this.ocrImage.pickColor(x, y));
    
            return Color.findMedian(colors);
        }
    
        getSvgData() {
            if (this._data) {
                return this._data;
            }
    
            const resOptions = this.options.result;
    
            const transparencyPatches = [];
    
            let commonFontFamily = resOptions.fontFamily;
    
            const paths = this.blocks.reduce((paths, block) => {
                const maxBaselineDelta = Math.max(Math.round(block.w / 100), 2);
                const xs = block.boxes.map(
                    ({ polyCoefs: { fromXtoY }, x, y }) => fromXtoY ? x : y);
                const baselines = groupValues(xs, maxBaselineDelta);
    
                const hhs = block.boxes.map(
                    ({ polyCoefs: { hh } }) => Math.ceil(hh * resOptions.hhToFontSizeRatio));
    
                const hhsAvg = getAvg(hhs);
                const maxHhDelta = Math.max(Math.round(hhsAvg / 10), 3);
                const hhBaselines = groupValues(hhs, maxHhDelta);
    
                if (resOptions.arrangeBlockTranslations) {
                    const stop$ = this.stats.sum$(ImageStats.benchmarks.arrangeTexts);
                    this._arrangeBlockTranslations(block);
                    stop$();
                }
    
                if (!block.blockId) {
                    block.blockId = `block-${SvgImage.blockCounter++}`;
    
                    ItemsStore.addBlock(block);
                }
    
                block.paths = block.boxes.map((origBox) => {
                    const flip = !origBox.polyCoefs.fromXtoY;
    
                    let textColor = this.findColorByPoints(origBox.textColor.Points);
                    let backgroundColor = this.findColorByPoints(origBox.backgroundColor.Points);
    
                    if (this.options.result.enableContrastAdjusting) {
                        textColor = Color.getAdjustedColor(
                            textColor, backgroundColor, this.options.contrastOptions)
                    }
    
                    let fontFamily = resOptions.fontFamily;
    
                    const x = flip ? origBox.y : origBox.x;
                    let w = flip ? origBox.h : origBox.w;
    
                    const startPoint = pickBestValue(x, baselines, maxBaselineDelta);
    
                    const baseHh = Math.ceil(origBox.polyCoefs.hh * resOptions.hhToFontSizeRatio);
                    const resHh = pickBestValue(baseHh, hhBaselines, maxHhDelta);
    
                    let hh = resOptions.enableLinesHeightAlign ? resHh : baseHh;
    
                    if (backgroundColor.a < resOptions.transparencyPatchingBorder) {
                        transparencyPatches.push({ ...origBox, backgroundColor });
                    }
    
                    if (resOptions.extendLineWidth) {
                        w += Math.round(hh * resOptions.extendableWidthToHhRatio * 10) / 10;
                    }
    
                    let newHh = SvgImage.findBestFontSize(origBox.translation, w, hh, fontFamily);
    
                    if (newHh < hh && resOptions.enableCondensedFont) {
                        fontFamily = resOptions.condensedFontFamily;
                        commonFontFamily = resOptions.condensedFontFamily;
                        newHh = SvgImage.findBestFontSize(origBox.translation, w, hh, fontFamily);
                    }
    
                    const path = {
                        flip,
                        textColor,
                        fontFamily,
                        backgroundColor,
                        text: origBox.text,
                        translation: origBox.translation,
                        parentBlock: block,
                    };
    
                    path.width = w;
                    path.hh = Math.round(newHh); // newHh
                    path.startPoint = resOptions.enableLinesXAlign ? startPoint : x;
                    path.pathId = `path-${SvgImage.pathCounter++}`;
                    path.strPath = Bezier.getBoxPath(origBox, path);
                    path.origHh = hh;
                    path.coefs = origBox.polyCoefs;
    
                    if (newHh >= hh && resOptions.enableTextAdjusting) {
                        path.textLength = false;
                        path.width = null;
                    } else {
                        path.lengthAdjust = true;
                    }
    
                    if (this.options.session.enableTextPopup) {
                        path.isCondense = this._isPathCondense(origBox, path);
                    }
    
                    ItemsStore.addPath(path);
    
                    return path;
                });
    
                paths.push(...block.paths);
    
                return paths;
            }, []);
    
            this.ocrImage.clearImageDataCache();
    
            this._data = {
                paths,
                transparencyPatches,
                commonFontFamily,
            };
    
            return this._data;
        }
    
        _isPathCondense(origBox, path) {
            const criteria = this.options.textCondenseCriteria;
            const imageScale = this.stats.getOcrImageScale();
    
            const fontScale = imageScale ?
                Math.min((imageScale[0] + imageScale[1]) / 2, 1) : 1;
    
            path.edges = Bezier.getEdgesCoords(origBox, path);
            path.absHh = Math.round(fontScale * path.hh * 10) / 10;
    
            path.boxRatio = SvgImage.getTextBoxRatio(
                origBox.translation, path.width, path.hh, path.fontFamily);
    
            path.textsRatio = SvgImage.getTextsRatio(
                origBox.translation, origBox.text, path.hh, path.fontFamily);
    
            path.condenseRatio = (path.boxRatio + path.textsRatio) / 2;
    
            const condenseQualityFontRatio = path.condenseRatio > 1 ?
                (path.condenseRatio - 1) * criteria.condenseToFontGrowRatio + 1 : 1;
    
            const bigFontAdjustRatio = path.absHh > criteria.bigAbsFontBorder ?
                (path.absHh / criteria.bigAbsFontBorder - 1) *
                criteria.condenseToFontGrowRatio + 1 : 1;
    
            path.adjustedCondenseRatio = path.condenseRatio / bigFontAdjustRatio;
    
            /*
                if font is relatively normal (i.e. 13px > 10)
                and condense ratio is not enough (i.e. 2.0 < 2.5)
                then we want to highlight it anyway
            */
            path.adjustedToQualityFont = path.absHh / condenseQualityFontRatio;
    
            return path.adjustedCondenseRatio > criteria.condenseRatioBorder ||
                path.absHh < criteria.absFontSizeBorder ||
                path.adjustedToQualityFont < criteria.absFontSizeBorder;
        }
    
        _getLineCondenseRatio(line, customTranslation = null) {
            const resOptions = this.options.result;
            const hh = Math.ceil(line.polyCoefs.hh * resOptions.hhToFontSizeRatio);
            const tr = customTranslation !== null ? customTranslation : line.translation;
    
            return SvgImage.getTextsRatio(tr, line.text, hh, resOptions.fontFamily);
        }
    
        _arrangeBlockTranslations({ boxes: lines = [] }) {
            if (lines.length < 2) {
                return;
            }
    
            let totalRatio = 0;
    
            const getRatio = (line, translation) => {
                return this._getLineCondenseRatio(line, translation);
            };
    
            lines.forEach((line) => {
                line.trRatio = getRatio(line, line.translation);
                totalRatio += line.trRatio;
            });
    
            const targetRatio = totalRatio / lines.length;
    
            const getDistance = (...ratios) => {
                return ratios.reduce((acc, v) => acc + Math.abs(v - targetRatio), 0);
            };
    
            const trySwapPair = (a, b) => {
                const aWords = a.translation.split(' ');
                const bWords = b.translation.split(' ');
    
                if (aWords.length && a.trRatio > b.trRatio) {
                    bWords.unshift(aWords.pop()); // a is more condense
                } else if(bWords.length && a.trRatio < b.trRatio) {
                    aWords.push(bWords.shift()); // b is more condense
                } else {
                    return false;
                }
    
                const aTranslation = aWords.join(' ');
                const bTranslation = bWords.join(' ');
    
                const aRatio = getRatio(a, aTranslation);
                const bRatio = getRatio(b, bTranslation);
    
                const distance = getDistance(a.trRatio, b.trRatio);
                const newDistance = getDistance(aRatio, bRatio);
    
                if (newDistance > distance) {
                    return false;
                }
    
                a.trRatio = aRatio; a.translation = aTranslation;
                b.trRatio = bRatio; b.translation = bTranslation;
    
                return true;
            };
    
            const trySwapTriple = (a, b, c) => {
                const aWords = a.translation.split(' ');
                const bWords = b.translation.split(' ');
                const cWords = c.translation.split(' ');
    
                if (aWords.length && a.trRatio > c.trRatio) {
                    bWords.unshift(aWords.pop()); // a is more condense
                    cWords.unshift(bWords.pop());
                } else if(cWords.length && a.trRatio < c.trRatio) {
                    aWords.push(bWords.shift()); // c is more condense
                    bWords.push(cWords.shift());
                } else {
                    return false;
                }
    
                const aTranslation = aWords.join(' ');
                const bTranslation = bWords.join(' ');
                const cTranslation = cWords.join(' ');
    
                const aRatio = getRatio(a, aTranslation);
                const bRatio = getRatio(b, bTranslation);
                const cRatio = getRatio(c, cTranslation);
    
                const distance = getDistance(a.trRatio, b.trRatio, c.trRatio);
                const newDistance = getDistance(aRatio, bRatio, cRatio);
    
                if (newDistance > distance) {
                    return false;
                }
    
                a.trRatio = aRatio; a.translation = aTranslation;
                b.trRatio = bRatio; b.translation = bTranslation;
                c.trRatio = cRatio; c.translation = cTranslation;
    
                return true;
            };
    
            const arrangeDoubles = () => {
                let swappedAny = false;
    
                for(let j = 0; j < 6; j++) {
                    let wordsSwapped = false;
    
                    for (let i = 1; i < lines.length; i++) {
                        if (trySwapPair(lines[i - 1], lines[i])) {
                            swappedAny = true;
                            wordsSwapped = true;
                        }
                    }
    
                    if (!wordsSwapped) {
                        break;
                    }
                }
    
                return swappedAny;
            };
    
            const arrangeTriples = () => {
                let swappedAny = false;
    
                for(let j = 0; j < 3; j++) {
                    let wordsSwapped = false;
    
                    for (let i = 1; i < lines.length - 1; i++) {
                        if (trySwapTriple(lines[i - 1], lines[i], lines[i + 1])) {
                            swappedAny = true;
                            wordsSwapped = true;
                        }
                    }
    
                    if (!wordsSwapped) {
                        break;
                    }
                }
    
                return swappedAny;
            };
    
            arrangeDoubles();
    
            if (lines.length >= 3) {
                if (arrangeTriples()) {
                    arrangeDoubles();
                }
            }
        }
    
        _getSvg() {
            const { width, height } = this.ocrImage.getSizes();
            const { paths } = this.getSvgData();
            const { blurLines } = this.options.result;
    
            return `
                <svg xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 ${width} ${height}"
                    ${this._getSvgRenderingOptions()}>
                    ${this._getSvgDefs()}
                    ${this._getSvgStyles()}
                    <g>
                    ${paths.map((path) => (`
                        <path id="${path.pathId}"
                            d="${path.strPath}"
                            fill="transparent"
                            stroke="${path.backgroundColor}"
                            stroke-width="${path.origHh * 1.2}px"
                            ${blurLines ? 'filter="url(#bl)"' : ''}/>
                    `)).join('')}
    
                    ${paths.map((path) => (
                        this._getSvgTextNode(path, path.textColor)
                    )).join('')}
                    </g>
                </svg>
            `;
        }
    
        _getTextOverlaySvg() {
            const svgData = this.getSvgData();
            const { width, height } = this.ocrImage.getSizes();
    
            const paths = svgData.paths.filter((path) => path.isCondense);
    
            if (!paths.length) {
                return null;
            }
    
            const blockPaths = {};
    
            paths.forEach((path) => {
                const block = path.parentBlock;
    
                if (!blockPaths[block.blockId]) {
                    blockPaths[block.blockId] = { block, paths: [] };
                }
    
                blockPaths[block.blockId].paths.push(path);
            });
    
            const textPaths = this.options.textOverlayOptions.showTextInHighlights ?
                Object.values(blockPaths).map(({ block, paths }) => `
                    <g ${TextOverlay.BLOCK_ID_ATTR}="${block.blockId}">
                        ${paths.map((path) => this._getSvgTextNode(path, path.textColor)).join('')}
                    </g>
                `) : '';
    
            return `
                <svg xmlns="http://www.w3.org/2000/svg"
                    class="ytr-text-overlay"
                    viewBox="0 0 ${width} ${height}"
                    data-base-width="${width}"
                    data-base-height="${height}"
                    ${this._getSvgRenderingOptions()}>
                    ${this._getSvgDefs()}
                    ${this._getSvgStyles()}
                    ${Object.values(blockPaths).map(({ block, paths, _bg }) => (`
                        <g ${TextOverlay.BLOCK_ID_ATTR}="${block.blockId}">
                        ${paths.map((path) => (`
                            <path id="${path.pathId}"
                                fill="transparent"
                                d="${path.strPath}"
                                ${TextOverlay.BLOCK_ID_ATTR}="${block.blockId}"
                                ${TextOverlay.PATH_ID_ATTR}="${path.pathId}"
                                stroke-linecap="round"
                                stroke-width="${path.hh * 1.2}px"/>
                        `)).join('')}
                        </g>
                    `))}
                    ${textPaths}
                </svg>
            `;
        }
    
        _getSvgTextNode(path, fill) {
            const { enableTextAdjusting } = this.options.result;
    
            return `
                <text
                    dy="0.3em"
                    font-size="${path.hh}px"
                    fill="${fill}"
                    ${TextOverlay.PATH_ID_ATTR}="${path.pathId}"
                    ${path.fontFamily ? `font-family="${path.fontFamily}"` : ''}
                    ${path.textAnchor ? `text-anchor="middle"` : ''}
                    ${path.width ? `textLength="${path.width}"` : ''}
                    ${path.lengthAdjust || !enableTextAdjusting ?
                        `lengthAdjust="spacingAndGlyphs"` : ''}>
                    <textPath
                        href="#${path.pathId}"
                        ${TextOverlay.PATH_ID_ATTR}="${path.pathId}"
                        ${path.lengthAdjust || !enableTextAdjusting ?
                            `lengthAdjust="spacingAndGlyphs"` : ''}
                        ${path.width ? `textLength="${path.width}"` : ''}>
                        ${escapeHtml(path.translation)}
                    </textPath>
                </text>
            `;
        }
    
        _getSvgDefs() {
            return `
                <defs>
                    <filter id="bl" filterUnits="userSpaceOnUse">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
                        <feColorMatrix type="matrix" values="1 0 0 0 0
                                                             0 1 0 0 0
                                                             0 0 1 0 0
                                                             0 0 0 1.6 0"/>
                    </filter>
                </defs>
            `;
        }
    
        _getSvgStyles() {
            const { commonFontFamily } = this.getSvgData();
    
            return `
                <style>
                    text {
                        font-family: ${commonFontFamily || 'inherit'};
                        text-anchor: start;
                    }
                </style>
            `;
        }
    
        _getSvgRenderingOptions() {
            return `
                text-rendering="geometricPrecision"
                shape-rendering="geometricPrecision"
                image-rendering="optimizeQuality"
                color-rendering="optimizeQuality"
            `;
        }
    
        static svgStringToBase64(svgString, width, height) {
            return 'data:image/svg+xml;base64,' + btoa(unescape(
                encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" ' +
                    'width="' + width + '" height="' + height + '">' + svgString + '</svg>')
                    .replace(/%([0-9A-F]{2})/g, (match, p1) => {
                        const c = String.fromCharCode(`0x${p1}`);
                        return c === '%' ? '%25' : c;
                    }),
            ));
        }
    
        static findBestFontSize(text, boxWidth, hh, fontFamily) {
            const ratio = this.getTextBoxRatio(text, boxWidth, hh, fontFamily);
    
            if (ratio > 1) {
                const newHh = hh / ratio;
                return newHh > 0.9 * hh ? newHh : Math.max((newHh + 0.9 * hh) / 2, hh * 0.5);
            } else {
                return Math.min(Math.round(hh / Math.pow(ratio, 1.5)), hh * 1);
            }
        }
    
        static getTextBoxRatio(text, boxWidth, hh, fontFamily) {
            const font = this._makeFontRule(hh, fontFamily);
            const width = this.getTextWidth(text, font);
    
            return boxWidth ? width / boxWidth : 0;
        }
    
        static getTextsRatio(text1, text2, hh, fontFamily) {
            const font = this._makeFontRule(hh, fontFamily);
            const width1 = SvgImage.getTextWidth(text1, font);
            const width2 = SvgImage.getTextWidth(text2, font);
    
            return width2 ? width1 / width2 : 0;
        }
    
        static _makeFontRule(fontSize, fontFamily) {
            return `normal ${fontSize}px ${fontFamily}`;
        }
    
        static getTextWidth(text, font) {
            if (!this._$textSizeCanvas) {
                this._$textSizeCanvas = CanvasImage.createCanvasElement();
            }
            const $canvas = this._$textSizeCanvas;
            const context = $canvas.getContext('2d');
            context.font = font;
            const metrics = context.measureText(text);
            return metrics.width;
        }
    }
    
    class TextOverlay {
        static HOVER_ATTR = 'data-hover';
        static HOVER_ACTIVE = 'true';
    
        static PATH_ID_ATTR = 'data-path-id';
        static BLOCK_ID_ATTR = 'data-block-id';
    
        _visible = false;
        _visibilityHandlers = [];
    
        overlayShowed = false;
        enabled = false;
    
        $overlay;
        $baseImg;
    
        constructor() {
            win.addEventListener('resize', debounce(() => {
                this.updateOverlayPosition();
            }, 200));
        }
    
        onVisibilityChange(callback) {
            this._visibilityHandlers.push(callback);
        }
    
        setEnabled(enabled) {
            this.enabled = enabled;
    
            if (!enabled) {
                this.overlayShowed = false;
            }
    
            this._applyVisibility();
        }
    
        setShowed(showed) {
            if (this.overlayShowed === showed) {
                return;
            }
    
            this.overlayShowed = showed;
            this._applyVisibility();
        }
    
        updateOverlay($baseImg, overlaySvg) {
            if (this.$overlay) {
                HtmlElement.getContainerElement().removeChild(this.$overlay);
            }
    
            this.$baseImg = $baseImg;
            this.$overlay = HtmlElement.htmlToEl(overlaySvg);
            this._visible = false;
            this._applyVisibility();
    
            HtmlElement.getContainerElement().appendChild(this.$overlay);
    
            this.updateOverlayPosition();
            this._addOverlayEvents();
        }
    
        updateOverlayPosition() {
            if (!this.overlayShowed || !this.enabled) {
                return;
            }
    
            const rect = HtmlElement.getAbsRect(this.$baseImg);
    
            this.top = rect.y;
            this.left = rect.x;
    
            HtmlElement.setStyles(this.$overlay, {
                top: `${this.top}px`,
                left: `${this.left}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
            });
        }
    
        _applyVisibility() {
            if (!this.$overlay) {
                return;
            }
    
            const visible = this.enabled && this.overlayShowed;
    
            if (visible !== this._visible) {
                this._visible = visible;
                this.$overlay.style.display = visible ? 'block' : 'none';
                this._visibilityHandlers.forEach((handler) => handler(visible));
            }
        }
    
        _getOverlayScale() {
            const baseWidth = parseFloat(
                this.$overlay.getAttribute('data-base-width'));
            const baseHeight = parseFloat(
                this.$overlay.getAttribute('data-base-height'));
    
            const realWidth = this.$overlay.clientWidth;
            const realHeight = this.$overlay.clientHeight;
    
            return [
                realWidth ? realWidth / baseWidth : 1,
                realHeight ? realHeight / baseHeight : 1
            ];
        }
    
        _addOverlayEvents() {
            const $$paths = Array.from(this.$overlay.querySelectorAll('path'));
    
            const pathsMap = Object.fromEntries($$paths.map(($path) => [
                $path.getAttribute(TextOverlay.PATH_ID_ATTR), $path]));
    
            let $shownPath = null;
            let _hideTimeout = null;
    
            const getAbsolutePosition = ({ x, y }) => {
                const [xScale, yScale] = this._getOverlayScale();
    
                return {
                    x: this.left + x * xScale,
                    y: this.top + y * yScale,
                };
            };
    
            const showPopup = ($path) => {
                if ($shownPath === $path) {
                    return;
                } else if ($shownPath && $shownPath !== $path) {
                    hidePopup($shownPath);
                }
    
                if (_hideTimeout) {
                    clearTimeout(_hideTimeout);
                    _hideTimeout = null;
                }
    
                $shownPath = $path;
    
                const [xScale,] = this._getOverlayScale();
    
                const overlayWidth = this.$overlay.clientWidth;
                const path = ItemsStore.getPath(
                    $path.getAttribute(TextOverlay.PATH_ID_ATTR));
                const block = ItemsStore.getBlock(
                    $path.getAttribute(TextOverlay.BLOCK_ID_ATTR));
    
                const showBlock = false;
    
                if (showBlock) {
                    const firstPath = block.paths[0];
                    const lastPath = block.paths[block.paths.length - 1];
                    const baseWidth = Math.max(...block.paths.map(({ width }) => width)) * xScale;
    
                    const top = getAbsolutePosition(firstPath.edges.top);
                    const bottom = getAbsolutePosition(lastPath.edges.bottom);
    
                    const src = block.paths.map(({ text }) => text).join(' ');
                    const dst = block.paths.map(({ translation }) => translation).join(' ');
    
                    $shownPath.parentNode.setAttribute(
                        TextOverlay.HOVER_ATTR, TextOverlay.HOVER_ACTIVE);
    
                    TextPopup.show(top, bottom, baseWidth, overlayWidth, src, dst);
                } else {
                    const { text: src, translation: dst, width, edges } = path;
    
                    const baseWidth = width * xScale;
                    const top = getAbsolutePosition(edges.top);
                    const bottom = getAbsolutePosition(edges.bottom);
    
                    $shownPath.setAttribute(
                        TextOverlay.HOVER_ATTR, TextOverlay.HOVER_ACTIVE);
    
                    TextPopup.show(top, bottom, baseWidth, overlayWidth, src, dst);
                }
            };
    
            const hidePopup = () => {
                if ($shownPath) {
                    $shownPath.parentNode.removeAttribute(TextOverlay.HOVER_ATTR);
                    $shownPath.removeAttribute(TextOverlay.HOVER_ATTR);
                }
    
                $shownPath = null;
                TextPopup.hide();
            };
    
            const getAssociatedPath = ($el) => {
                return pathsMap[
                    $el.getAttribute &&
                    $el.getAttribute(TextOverlay.PATH_ID_ATTR)];
            };
    
            this.$overlay.addEventListener('mouseenter', (e) => {
                const $path = getAssociatedPath(e.target);
    
                if ($path) {
                    showPopup($path, e);
                }
            }, true);
    
            this.$overlay.addEventListener('mouseleave', (e) => {
                const $path = getAssociatedPath(e.target);
    
                if (!$path && $shownPath) {
                    hidePopup();
                }
            }, true);
        }
    }
    
    class TextPopup {
        static CLASS_ACTIVE = 'ytr-image-popup__shown';
        static CLASS_VISIBLE = 'ytr-image-popup__visible';
    
        static POSITION_ATTR = 'data-position';
        static POSITION_TOP = 'top';
        static POSITION_BOTTOM = 'bottom';
    
        static _instance;
    
        $popup;
    
        constructor() {
            this._buildPopup();
        }
    
        async update(top, bottom, baseWidth, imageWidth, src, dst) {
            this.hide();
            this.$popup.classList.add(TextPopup.CLASS_ACTIVE);
            await wait(0);
            this.$popup.classList.add(TextPopup.CLASS_VISIBLE);
    
            this.$popup.innerHTML = this._getPopupHtmlContent(src, dst);
    
            const maxWidth = Math.min(Math.min(baseWidth * 2, imageWidth * 0.9), win.innerWidth * 0.8);
            const minWidth = Math.max(baseWidth * 0.9, 180);
    
            HtmlElement.setStyles(this.$popup, {
                top: `${top.y}px`,
                left: `${top.x}px`,
                maxWidth: `${Math.max(maxWidth, minWidth)}px`,
                minWidth: `${minWidth}px`,
                width: 'auto',
                margin: 0,
            });
    
            this._adjustPosition(top, bottom);
        }
    
        hide() {
            this.$popup.classList.remove(TextPopup.CLASS_ACTIVE);
            this.$popup.classList.remove(TextPopup.CLASS_VISIBLE);
        }
    
        _adjustPosition(top, bottom) {
            const rect = this.$popup.getBoundingClientRect();
            const { offsetWidth, offsetHeight: height } = this.$popup;
            const width = offsetWidth + 2;
    
            const offset = 8;
            const canFitTop = height < rect.y - offset;
            const marginTop = canFitTop ? -(height + offset) : offset;
    
            const y = canFitTop ? top.y : bottom.y;
            const x = canFitTop ? top.x : bottom.x;
    
            this.$popup.setAttribute(TextPopup.POSITION_ATTR,
                canFitTop ? TextPopup.POSITION_TOP : TextPopup.POSITION_BOTTOM);
    
            HtmlElement.setStyles(this.$popup, {
                top: `${y}px`,
                left: `${x}px`,
                margin: `${marginTop}px 0 0 -${width / 2}px`,
                width: `${width}px`,
            });
        }
    
        _buildPopup() {
            this.$popup = doc.createElement('div');
            this.$popup.classList.add('ytr-image-popup');
            HtmlElement.getContainerElement().appendChild(this.$popup);
        }
    
        _getPopupHtmlContent(src, dst) {
            return `
                <div class="ytr-image-popup__arrow"></div>
                <div class="ytr-image-popup__content" translate="no">
                    <div class="ytr-image-popup__block ytr-image-popup__block_dst">
                        <div class="ytr-image-popup__block-content">
                            <span class="ytr-image-popup__text_dst">${dst}</span>
                        </div>
                    </div>
                    <div class="ytr-image-popup__logo"></div>
                </div>
            `;
        }
    
        /**
         * @return {TextPopup}
         */
        static getInstance() {
            if (!this._instance) {
                this._instance = new TextPopup();
            }
    
            return this._instance;
        }
    
        static async show(top, bottom, baseWidth, imageWidth, src, dst) {
            await this.getInstance().update(top, bottom, baseWidth, imageWidth, src, dst);
        }
    
        static hide() {
            this.getInstance().hide();
        }
    }
    
    class VisualProgress {
        static HIDING_DURATION = 300;
    
        static IN_PROGRESS = 'in_progress';
        static DONE = 'done';
        static INACTIVE = 'inactive';
    
        status;
    
        $progress;
        $origImage;
        $translatedImage;
    
        /**
         * @param {ImageController} imgCtrl
         * @param {SessionOptions} options
         */
        constructor(imgCtrl, options) {
            this.$origImage = imgCtrl.origImage.getElement();
            this.options = options;
        }
    
        setTranslatedImage($img) {
            this.$translatedImage = $img;
        }
    
        showProgress() {
            if (!this.$origImage) {
                return;
            }
    
            this.status = VisualProgress.IN_PROGRESS;
            this.update();
    
            setTimeout(() => this._setVisibility(true), 0);
        }
    
        showSuccess() {
            if (!this.$translatedImage) {
                return;
            }
    
            this.status = VisualProgress.DONE;
            this.update();
    
            setTimeout(() => this.hide(),
                this.options.visualProgress.doneDuration);
        }
    
        hide() {
            this._setVisibility(false);
    
            setTimeout(() => {
                this.status = VisualProgress.INACTIVE;
                this.update();
            }, VisualProgress.HIDING_DURATION);
        }
    
        update() {
            const $progress = this._getProgressElement();
    
            if (this._cancelBoundTracker) {
                this._cancelBoundTracker();
            }
    
            if (this.status !== VisualProgress.INACTIVE) {
                this._cancelBoundTracker = HtmlElement.onBoundChange(
                    this._getActiveImage(),
                    this._updatePosition.bind(this),
                    this.options.visualProgress.boundListenerInterval);
            }
    
            $progress.setAttribute('status', this.status);
    
            this._updatePosition();
        }
    
        _setVisibility(visible) {
            this._getProgressElement().setAttribute('visible', String(visible));
        }
    
        _updatePosition() {
            const $progress = this._getProgressElement();
            const rect = this._getImageBound();
    
            if (!rect || !rect.width) {
                return $progress.setAttribute('status', VisualProgress.INACTIVE);
            }
    
            HtmlElement.setStyles($progress, {
                top: `${rect.y}px`,
                left: `${rect.x}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
            });
        }
    
        _getProgressElement() {
            if (!this.$progress) {
                this.$progress = HtmlElement.htmlToEl(`
                    <div class="ytr-vp-container">
                        <div class="ytr-vp-bubble">
                            <div class="ytr-vp-bubble-icons">
                                <div class="ytr-vp-icon ytr-vp-icon_spinner"></div>
                                <div class="ytr-vp-icon ytr-vp-icon_done"></div>
                            </div>
                        </div>
                    </div>
                `);
    
                HtmlElement.getContainerElement().appendChild(this.$progress);
            }
    
            return this.$progress;
        }
    
        _getImageBound() {
            return HtmlElement.getAbsRect(this._getActiveImage());
        }
    
        _getActiveImage() {
            return this.status === VisualProgress.DONE ?
                this.$translatedImage : this.$origImage;
        }
    }
    
    class ImageTranslatorStyles {
        static _stylesInserted = false;
    
        static ensureStyles() {
            if (!this._stylesInserted) {
                this._insertStyles();
            }
        }
    
        static _insertStyles() {
            const styleRules = this._getRules();
    
            let $style = document.querySelector('style');
    
            if (!$style) {
                $style = document.createElement('style');
                doc.documentElement.appendChild($style);
            }
    
            styleRules.forEach((rule) => {
                $style.sheet.insertRule(rule, $style.sheet.cssRules.length || 0);
            });
        }
    
        static _getRules() {
            return [
                // overlay
                `.ytr-text-overlay {
                    --highlight-bg: rgba(255, 204, 0, .12);
                    --highlight-active-bg: rgba(255, 204, 0, .4);
                }`,
                `.ytr-text-overlay {
                    pointer-events: none;
                    user-select: none;
                    position: absolute;
                    z-index: 2147483646;
                    display: none;
                }`,
                `.ytr-text-overlay path,
                 .ytr-text-overlay text {
                    pointer-events: auto;
                    user-select: none;
                }`,
                `.ytr-text-overlay path {
                    stroke: var(--highlight-bg);
                }`,
                `.ytr-text-overlay [data-hover] {
                    stroke: var(--highlight-active-bg);
                }`,
                // popup
                `.ytr-image-popup {
                    --arrow-height: 6px;
                    --arrow-width: 20px;
                    --bg-color: #fff;
                    --text-color: #000;
                    --arrow-height-negative: calc(-1 * var(--arrow-height));
                }`,
                `.ytr-image-popup {
                    user-select: none;
                    box-sizing: border-box;
                    box-shadow: 1px 1px 3px rgba(0, 0, 0, 0.12),
                                5px 5px 25px rgba(0, 0, 0, 0.14);
                    position: absolute;
                    background: var(--bg-color);
                    color: var(--text-color);
                    border-radius: 8px;
                    display: none;
                    z-index: 2147483647;
                    visibility: hidden;
                    margin: 0;
                    font-size: 15px;
                    font-family: "YS Text", -apple-system, Roboto, Arial, Helvetica, sans-serif;
                    text-align: center;
                    color: #000;
                    opacity: 0;
                    transform: translateY(-10px);
                    transition: opacity ease-out 0.2s,
                                transform ease-out 0.1s;
                    transition-delay: 0.15s;
                }`,
                `.ytr-image-popup[data-position="bottom"] {
                    transform: translateY(10px);
                }`,
                `.ytr-image-popup__shown {
                    display: block;
                    visibility: visible;
                }`,
                `.ytr-image-popup.ytr-image-popup__visible {
                    opacity: 1;
                    transform: translateY(0);
                }`,
                `.ytr-image-popup__arrow {
                    display: inline-block;
                    margin-left: calc(var(--arrow-width) / -2);
                    width: var(--arrow-width);
                    height: var(--arrow-height);
                    position: absolute;
                    background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAMCAYAAAAQw/9NAAAACXBIWXMAABYlAAAWJQFJUiTwAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAKRSURBVHgBrVXLihpBFO221c7YPqbHFz4QQceFCyNx5SLg1uzFP/A7XBtmmzAmu0Ag/oe4Fp8IgmJ2MgtXiYFO5562ylR3x0wec+FYZVl176lz7y0licw0TZkGmUZ8xdzTarWU4XCY2Gw2rw6Hw6fj8fjZfCIzDOOw3+9f73a75mg0Sna7XS9istgiD1kSFzhRgjIYDBQaveVyOZhKpWK9Xu/ler3+aP6nbbfbD+12+3k4HL4hvwGK4SeCHpGgA5aCZ6JsswIFgWazqcJRLpfT4/F4cbFY3Jv/aDibSCQKoVAoRjECjUbDCyDe7wjKjJSloHAbK81QkeCrVCoaHKuqWppOp+/Mv7TZbHZPfoqlUskiB+UEci6CJs+m+TOtYoptJGu1mq9YLFpKIt1E8nYymfwxSbpQH2cymUw0mUxq8MXIWTG4KFwogYvkrD2bggIUpqYPtw8Gg3EEHI/H7x8jx5S7xcWQBSjHfCkiOQ6Ri9gkLhWFgwqbW+nA7akWg5TuKEt3/xI51BydKRFivCE6nY5PJPiIgrJHspsMO3fPyUw6CMLfybGUzWYNIvgtEAh89fv9D/V6/W4+n/cdfiSsVavVO5o+UFq/aJpmUKmY6XTa4H7xQX4BxDgtnhrWTsoBseV5oyjiiJqkuUqwlKSxsFwu33LlVqvVG1K3QJe5Qc1JQkOIXQtfDvXcnQwpHXk/k8Mh/CakROFBAHoj/fRdi0QiejQazdC+Gr1xL3Rdz9G6DnLYg72OtCqSu84vvYWnfxKQEWrAVrz8bRTBVPSipkipK9TlNVk+n7+GsoQrqIx9AAhy9QR/zng2cryT5UtpdsivXIAXBJiaKhF8hkaiuY9fgu/lj7/0i+6V3E+dNf8BVk9m7USqmVUAAAAASUVORK5CYII=');
                    background-size: contain;
                }`,
                `.ytr-image-popup__logo {
                    position: absolute;
                    right: 10px;
                    bottom: 10px;
                    width: 18px;
                    height: 18px;
                    background-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTYuOTc0OTggNi42NjI0NUM2Ljk3NDk4IDMuMTYyNDUgOS43NzQ5OCAwLjMyNDk1MSAxMy4yMjUgMC4zMjQ5NTFDMTYuNyAwLjMyNDk1MSAxOS41MTI1IDMuMTYyNDUgMTkuNTEyNSA2LjY2MjQ1QzE5LjUxMjUgMTAuMTYyNSAxNi43NjI1IDEzIDEzLjI2MjUgMTNDOS43NjI0OCAxMyA3LjAxMjQ4IDEwLjE2MjUgNy4wMTI0OCA2LjY2MjQ1IiBmaWxsPSJibGFjayIvPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTE1LjYyNSA2LjEzNzRDMTYuMTYyNSA2LjM4NzQgMTYuNTUgNi43NjI0IDE2Ljc1IDcuMjYyNEwxNi44ODc1IDcuMTI0OUMxNy4zODc1IDguNDQ5OSAxNi44NSA5Ljg3NDkgMTYuMDEyNSAxMC42MjQ5TDE1LjM4NzUgOS45NDk5QzE1Ljg4NzUgOS40OTk5IDE2LjM4NzUgOC40MTI0IDE2LjAxMjUgNy40OTk5QzE1Ljg4NzUgNy4xOTk5IDE1Ljc2MjUgNy4wNzQ5IDE1LjUxMjUgNi45NDk5QzE1LjI2MjUgNy41NzQ5IDE0Ljg4NzUgOC4zMjQ5IDE0LjI2MjUgOS4wNzQ5QzE0LjEzNzUgOS4yOTk5IDEzLjk4NzUgOS40MjQ5IDEzLjgxMjUgOS41NDk5QzE0LjE4NzUgMTAuMDQ5OSAxNC40Mzc1IDEwLjI5OTkgMTQuNDM3NSAxMC4yOTk5TDEzLjgxMjUgMTAuOTc0OUMxMy44MDU5IDEwLjk2MTggMTMuNzgxMiAxMC45MzMgMTMuNzQxNSAxMC44ODY5QzEzLjYzMDIgMTAuNzU3NyAxMy40MDE0IDEwLjQ5MjEgMTMuMTI1IDEwLjA0OTlDMTIuNjI1IDEwLjQyNDkgMTIgMTAuNjQ5OSAxMS41IDEwLjY0OTlMMTEuMTI1IDEwLjYyNDlDMTAuNjI1IDEwLjU0OTkgMTAuMjUgMTAuMjQ5OSAxMCA5Ljc0OTlDOS41IDguNjI0OSAxMC4zNzUgNy4xMjQ5IDExLjYyNSA2LjQ5OTlDMTEuNTY2NiA2LjE3MjYzIDExLjUzNTQgNS44NzI2OSAxMS41MDYxIDUuNTg5ODRDMTEuNDcyNyA1LjI2NzcxIDExLjQ0MTYgNC45Njc3NiAxMS4zNzUgNC42NzQ5SDExLjEyNUMxMC4zNzUgNC42NzQ5IDkuNzUgNC42MjQ5IDkuNSA0LjU3NDlWMy42MjQ5QzkuNjI1IDMuNjYyNCAxMC4zNzUgMy43NDk5IDExLjI1IDMuNzQ5OUwxMS4zNjI1IDIuODM3NEgxMi4yMzc1QzEyLjIzNzUgMi44Mzg5NSAxMi4yMzcxIDIuODQ2NjQgMTIuMjM2NCAyLjg2MDExQzEyLjIzMTcgMi45NTUzOCAxMi4yMTI1IDMuMzM5ODQgMTIuMjEyNSAzLjg4NzRDMTQuODEyNSAzLjYzNzQgMTYuMzc1IDMuMDEyNCAxNi4zNzUgMy4wMTI0TDE2LjcyNSAzLjg4NzRDMTYuNzEzOCAzLjg4NzQgMTYuNjY4IDMuOTA0MTMgMTYuNTg5IDMuOTMzMDFDMTYuMTM5IDQuMDk3NDkgMTQuNjEwNSA0LjY1NjA3IDEyLjI1IDQuNzYyNEMxMi4yNzU0IDQuOTE0ODUgMTIuMjk0NiA1LjA4Nzk1IDEyLjMxNTIgNS4yNzMzQzEyLjM0NTIgNS41NDM5MiAxMi4zNzgyIDUuODQwNjYgMTIuNDM3NSA2LjEzNzRDMTMuMjI1IDUuODg3NCAxNC4wMzc1IDUuNzYyNCAxNC43NSA1Ljg4NzRDMTQuODI1IDUuNjM3NCAxNC44MjUgNS4zODc0IDE0LjgyNSA1LjEzNzRIMTUuNzVDMTUuNzUgNS4zODc0IDE1LjcxMjUgNS43NjI0IDE1LjYyNSA2LjEzNzRaTTEzLjUgOC4zMjQ4OUwxMy4yODc1IDguNTQ5ODlDMTMuMDYyNSA4LjA3NDg5IDEyLjgzNzUgNy40OTk4OSAxMi42NjI1IDYuODI0ODlDMTMuMTg3NSA2LjYxMjM5IDEzLjcxMjUgNi40OTk4OSAxNC4yMTI1IDYuNDk5ODlDMTQuMzM3NSA2LjQ5OTg5IDE0LjQzNzUgNi40OTk4OSAxNC41Mzc1IDYuNTI0ODlDMTQuMzM3NSA3LjA4NzM5IDE0LjAxMjUgNy43MjQ4OSAxMy40ODc1IDguMzI0ODlIMTMuNVpNMTEuMTI1IDkuNTk5OTJDMTAuOTEyNSA5LjU2MjQyIDEwLjc3NSA5LjQ3NDkyIDEwLjcgOS4yNjI0MkMxMC40NSA4Ljc2MjQyIDEwLjk1IDcuODg3NDIgMTEuNzc1IDcuMzg3NDJDMTEuOTc1IDguMTM3NDIgMTIuMjM3NSA4Ljc2MjQyIDEyLjUgOS4yNjI0MkMxMiA5LjYzNzQyIDExLjUgOS43NjI0MiAxMS4xMjUgOS43NjI0MlY5LjU5OTkyWiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTAuMjk5OTg4IDEzLjQyNDlDMC4yOTk5ODggOS45MjQ5IDMuMDk5OTkgNy4wODc0IDYuNTQ5OTkgNy4wODc0QzEwLjAyNSA3LjA4NzQgMTIuODM3NSA5LjkyNDkgMTIuODM3NSAxMy40MjQ5QzEyLjgzNzUgMTYuOTI0OSAxMC4wMjUgMTkuNzYyNCA2LjU2MjQ5IDE5Ljc2MjRDMy4wOTk5OSAxOS43NjI0IDAuMzEyNDg4IDE3LjAxMjQgMC4zMTI0ODggMTMuNTEyNCIgZmlsbD0iI0ZGMDAwMCIvPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTYuMDYyNSA5LjM3NUg3LjA2MjVINy4wNzVMMTAuMTI1IDE2Ljg1SDguODc1TDguMTI1IDE0Ljg1SDVMNC4yNSAxNi44NUgzTDYuMDYyNSA5LjM3NVpNNi41NjI0OCAxMC45MTI1TDUuNDEyNDggMTMuODM3NUg3LjcxMjQ4TDYuNTYyNDggMTAuOTEyNVoiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=');
                    background-size: contain;
                }`,
                `.ytr-image-popup[data-position="bottom"] .ytr-image-popup__arrow {
                    top: var(--arrow-height-negative);
                    transform: rotate(180deg);
                }`,
                `.ytr-image-popup[data-position="top"] .ytr-image-popup__arrow {
                    bottom: var(--arrow-height-negative);
                }`,
                `.ytr-image-popup__content {
                    text-align: left;
                    padding: 12px;
                }`,
                `.ytr-image-popup__block-content {
                    line-height: 20px;
                }`,
                `.ytr-image-popup__block_src {
                    display: none;
                    color: #555;
                    font-size: 0.9em;
                }`,
                `.ytr-image-popup__text_dst {
                    padding-right: 20px;
                }`,
                `.ytr-image-popup__block-title {
                    font-size: 11px;
                    font-weight: bold;
                    opacity: 0.6;
                    margin: 0 0 4px 0;
                    line-height: 14px;
                }`,
                // visual progress
                `.ytr-vp-container {
                    display: none;
                    position: absolute;
                    padding: 0;
                    margin: 0;
                    font-size: 0;
                    pointer-events: none;
                    user-select: none;
                    transition: opacity ease-out 0.25s;
                    will-change: transform, opacity;
                    z-index: 2147483645;
                }`,
                `.ytr-vp-container[status="in_progress"],
                 .ytr-vp-container[status="done"] {
                    display: block;
                }`,
                `.ytr-vp-container,
                 .ytr-vp-container[visible="false"] {
                    opacity: 0;
                }`,
                `.ytr-vp-container[visible="true"] {
                    opacity: 1;
                }`,
                `.ytr-vp-bubble {
                    --bubble-size: 44px;
                    position: absolute;
                    width: var(--bubble-size);
                    height: var(--bubble-size);
                    border-radius: var(--bubble-size);
                    overflow: hidden;
                    left: 50%;
                    top: 50%;
                    margin: calc(var(--bubble-size) * -0.5) 0 0 calc(var(--bubble-size) * -0.5);
                    background: rgba(46, 47, 52, 0.5);
                }`,
                `.ytr-vp-container[status="done"] .ytr-vp-bubble-icons {
                    transform: translate3d(0, calc(var(--bubble-size) * -1), 0);
                    transition: transform ease-out 0.25s;
                }`,
                `.ytr-vp-icon {
                    width: var(--bubble-size);
                    height: var(--bubble-size);
                    background-position: center;
                    background-repeat: no-repeat;
                }`,
                `.ytr-vp-icon_spinner {
                    background-size: 32px;
                    animation: ytr-spin 1s 0.21s infinite linear;
                    background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAABYlAAAWJQFJUiTwAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAIgSURBVHgB7dqNUcIwFAfwP07ACN0ANrAb6AZ0A91ANtANcAOPCYQJcIOyAWzwfO8S7iCkPQhtksL73b3TqKRpmo8mEVBKKaWUUkqpBzRCJERU8pcJh3ydcoxtiD3H1saKYz0ajf4wdHzTY44PjpquV3PMOAoMkb3xHd2ulrwwFPLEODbUvZpybw1kmmzTU5ef/3K8cUw5xkefk65S2t/9tFSC5PGKHNmbbyr0/PiGL8irsJ+pG/KcISfyVBoK+nXNjXvylYr4zroSbCF9zf4dHZG8yN+yCqTW0EwrdEzy9Fxng5TITHW9PXnP9XwtYY4UbNOvncIs0DMy44rbFYLHmVsK4jbJOkafJDNl7pK3As/TnyMSMlPkSeUjJjIvMq4CkTS0ghIBnhCmdNJLXr1tEQlfS1aP7mpxigChFfDspFeIb+mkSwQIrYDCSadYu6+c9ASxePpf9GnIjgMn0yECBO0IydVOMmFIoItyhHaBXOyPvt8ilhy6gC1HZd9HpDwVYqHzl6CgKSgHoV3AHfVLDFRoBayd9AsGqqsWME01DiRDCRdDWaDzFVmadXkqDSuyTzwSTysQvW2JZYn8p0B57dv3iSJsi2eP/FvWYkFDPd29Vksl1GS2zwvcOzJHZG1H4nLwKQegJd3rlEn+84I28rf3N2hS++muK2g3J3u2NVQXVETcff0UyJwlHP4BQt4dDmNF3M0MpZRSSimllFLAP4OmIuqNCl8IAAAAAElFTkSuQmCC")
                }`,
                `.ytr-vp-icon_done {
                    background-size: 24px 25px;
                    background-image: url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjUiIHZpZXdCb3g9IjAgMCAyNCAyNSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0yNC4wMDAzIDguMDAxMTFDMjQuMDAwMyAxMi40MTk0IDIwLjQxODYgMTYuMDAxMSAxNi4wMDA0IDE2LjAwMTJDMTYuMDAwMiAxNC44NzgxIDE1Ljc2ODUgMTMuODA5MSAxNS4zNTA2IDEyLjgzOTJDMTUuNjM4NCAxMi42Nzg3IDE1LjkxODIgMTIuNDc3MiAxNi4xODczIDEyLjI0ODlDMTYuMzc5MiAxMi41MjU4IDE2LjU4NzUgMTIuODA0MSAxNi44MTI2IDEzLjA4NTRMMTcuMjI5IDEzLjYwNkwxOC4yNzAyIDEyLjc3M0wxNy44NTM3IDEyLjI1MjRDMTcuNTkwMiAxMS45MjMgMTcuMzU1MSAxMS42MDI2IDE3LjE0NjQgMTEuMjg3OEMxNy4yOTAxIDExLjEyMjUgMTcuNDI4NyAxMC45NTM4IDE3LjU2MTYgMTAuNzg0OUMxOC4xMzQgMTAuMDU3MSAxOC42Mzk5IDkuMjcyODggMTkuMDM0MSA4LjYwODk0QzE5LjE5NCA4LjczNTcxIDE5LjMzNTQgOC44ODM5NCAxOS40NTYzIDkuMDU0MjFDMTkuNTMxNSA5LjE2MDIzIDE5LjU3NCA5LjQyNTEzIDE5LjUxNzMgOS44MjQ3MUMxOS40OTI3IDkuOTk4MDYgMTkuNDU1MiAxMC4xNTczIDE5LjQyMzMgMTAuMjc0MUMxOS40MDc2IDEwLjMzMTkgMTkuMzkzNiAxMC4zNzc2IDE5LjM4NDEgMTAuNDA3N0MxOS4zODI3IDEwLjQxMiAxOS4zODE0IDEwLjQxNTkgMTkuMzgwMiAxMC40MTk2QzE5LjM3NzMgMTAuNDI4NiAxOS4zNzUgMTAuNDM1NSAxOS4zNzM1IDEwLjQ0MDFMMTkuMzcxNSAxMC40NDZMMTkuMzcxMyAxMC40NDY0TDE5LjM3MTIgMTAuNDQ2OEwxOS4xNDg3IDExLjA3MzhMMjAuNDA1MyAxMS41MTk2TDIwLjYyODIgMTAuODkxM0wyMCAxMC42Njg0QzIwLjYyODIgMTAuODkxMyAyMC42MjgzIDEwLjg5MTIgMjAuNjI4NCAxMC44OTFMMjAuNjI4NSAxMC44OTA3TDIwLjYyODcgMTAuODg5OUwyMC42Mjk0IDEwLjg4OEwyMC42MzEzIDEwLjg4MjdMMjAuNjM2OCAxMC44NjY0QzIwLjY0MTQgMTAuODUzIDIwLjY0NzQgMTAuODM0NyAyMC42NTQ3IDEwLjgxMTlDMjAuNjY5MSAxMC43NjY1IDIwLjY4ODQgMTAuNzAyOSAyMC43MDk2IDEwLjYyNTJDMjAuNzUxNyAxMC40NzEyIDIwLjgwMjkgMTAuMjU1NCAyMC44Mzc0IDEwLjAxMjFDMjAuODk5IDkuNTc4MyAyMC45NDE1IDguODQzMTkgMjAuNTQzNiA4LjI4MjUzTDIwLjU0MzYgOC4yODI1MkMyMC4yOTkyIDcuOTM4MTQgMjAuMDEwMiA3LjY1ODQzIDE5LjY5MDggNy40MzU0QzE5LjcxMjcgNy4zOTM4NiAxOS43MzMxIDcuMzU0NjIgMTkuNzUyMiA3LjMxNzg2QzE5LjgwOTkgNy4yMDY0NSAxOS44NTQ4IDcuMTE3NjMgMTkuODg1NSA3LjA1NjA2QzE5LjkwMDggNy4wMjUyNiAxOS45MTI2IDcuMDAxMjcgMTkuOTIwOCA2Ljk4NDY2TDE5LjkzMDIgNi45NjUzNEwxOS45MzI4IDYuOTU5OTdMMTkuOTMzNiA2Ljk1ODM3TDE5LjkzMzggNi45NTc4NUMxOS45MzM5IDYuOTU3NjcgMTkuOTM0IDYuOTU3NTIgMTkuMzMzMyA2LjY2ODM0TDE5LjkzNCA2Ljk1NzUyTDIwLjIyMzIgNi4zNTY4M0wxOS4wMjE4IDUuNzc4NDZMMTguNzMyNyA2LjM3OUwxOC43MzI3IDYuMzc5MDRMMTguNzMyNiA2LjM3OTE1TDE4LjczMjQgNi4zNzk2NkwxOC43MzA3IDYuMzgzMDZMMTguNzIzMyA2LjM5ODMyTDE4LjY5MjIgNi40NjEyMUMxOC42NjQ0IDYuNTE2OTUgMTguNjIyNyA2LjU5OTQ2IDE4LjU2ODUgNi43MDQxNEMxOC41NDE2IDYuNzU2MDEgMTguNTExNiA2LjgxMzI3IDE4LjQ3ODcgNi44NzUzOEMxOC4xNTc5IDYuNzg2ODQgMTcuODI2OCA2LjczMzkgMTcuNDk0OCA2LjcxMTM1QzE2LjkyMDggNi42NzIzOCAxNi4zMjkyIDYuNzIyMDYgMTUuNzUyMyA2Ljg0MTMyQzE1Ljc0OTYgNi40MzIyOCAxNS43NzI1IDYuMDAzODEgMTUuODE5OSA1LjU0OTgzQzE3LjQ5MTUgNS40MDI0NCAxOS4wNzQxIDUuMDEzNDQgMjAuMjEwOSA0LjYzNDQ5TDIwLjg0MzQgNC40MjM2N0wyMC40MjE4IDMuMTU4NzRMMTkuNzg5MyAzLjM2OTU2QzE4Ljc3MzMgMy43MDgyNCAxNy40MjY0IDQuMDM4MTkgMTYuMDE4OCA0LjE5MDU5QzE2LjA1ODkgMy45NzExOSAxNi4xMDM0IDMuNzQ1OTQgMTYuMTUyMSAzLjUxNDM3TDE2LjI4OTUgMi44NjE5OUwxNC45ODQ3IDIuNTg3MjlMMTQuODQ3NCAzLjIzOTY3QzE0Ljc3MjUgMy41OTUxNCAxNC43MDY1IDMuOTQwNDkgMTQuNjUgNC4yNzY5M0MxMy43OTEgNC4yODk0MiAxMi45NDE2IDQuMjE2OTEgMTIuMTYxNyA0LjAyMTkzTDExLjUxNDkgMy44NjAyNEwxMS4xOTE1IDUuMTUzNzhMMTEuODM4MyA1LjMxNTQ4QzEyLjY3OTggNS41MjU4NiAxMy41NzYxIDUuNjEyIDE0LjQ3NDEgNS42MTE0MkMxNC40MjI2IDYuMTc3MDEgMTQuNDA1OSA2LjcxOTEgMTQuNDI4OSA3LjI0NDcxQzE0LjMxMDQgNy4yOTI5OCAxNC4xOTM5IDcuMzQzOTUgMTQuMDc5NyA3LjM5NzM5QzEzLjIzNDMgNy43OTMwNiAxMi40NTIgOC4zNTYxNyAxMS45NDY1IDkuMDQxOTJDMTAuNzgyIDguMzgwMzIgOS40MzUyNCA4LjAwMjQ5IDguMDAwMjMgOC4wMDI0OUg4VjguMDAxMTFDOCAzLjU4Mjc2IDExLjU4MTggMC4wMDA5NzY1NjIgMTYuMDAwMSAwLjAwMDk3NjU2MkMyMC40MTg1IDAuMDAwOTc2NTYyIDI0LjAwMDMgMy41ODI3NiAyNC4wMDAzIDguMDAxMTFaTTE0LjcyMjIgMTEuNjYyOUMxNC4yNjQ4IDEwLjk1NTkgMTMuNjk4OSAxMC4zMjU3IDEzLjA0OCA5Ljc5NTcxQzEzLjM3MDkgOS4zNzUzOSAxMy45MDY4IDguOTU4OTMgMTQuNTkxNiA4LjYzMDNDMTQuNzU5NyA5LjQ4NTQ2IDE1LjA1MjggMTAuMjk0MiAxNS40Nzk3IDExLjA5NThDMTUuMjIyOSAxMS4zMyAxNC45Njg3IDExLjUyMjkgMTQuNzIyMiAxMS42NjI5Wk0xNi40NDU5IDEwLjA0NThDMTYuNDY4NSAxMC4wMTc2IDE2LjQ5MSA5Ljk4OTE1IDE2LjUxMzYgOS45NjA1NEMxNi45OTYyIDkuMzQ2OSAxNy40MzQyIDguNjgwMDkgMTcuNzkyNSA4LjA4Njk1QzE3LjY2NzIgOC4wNjU3NiAxNy41Mzc3IDguMDUwNjkgMTcuNDA0NSA4LjA0MTY1QzE2LjkxMDQgOC4wMDgxIDE2LjM4MzQgOC4wNjAxNSAxNS44NjQ5IDguMTgxNzlDMTUuODcxMSA4LjIxODc1IDE1Ljg3NzcgOC4yNTU1OCAxNS44ODQ1IDguMjkyM0MxNS45OTQ3IDguODg4MDcgMTYuMTc3MyA5LjQ2NDg2IDE2LjQ0NTkgMTAuMDQ1OFoiIGZpbGw9IndoaXRlIi8+CjxjaXJjbGUgY3g9IjguMDAwMTMiIGN5PSIxNi4wMDIxIiByPSI3LjMzMzQ1IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjEuMzMzMzYiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik03LjE1Mjk5IDEyLjEzMjFDNy4xODE3NCAxMi4wNTMxIDcuMjU2ODUgMTIuMDAwNSA3LjM0MDk0IDEyLjAwMDVINy42Njc3N0g4LjMzNDQ1SDguNjYxMzNDOC43NDU0NCAxMi4wMDA1IDguODIwNTYgMTIuMDUzMSA4Ljg0OTI5IDEyLjEzMjFMOC45NjA5OSAxMi40Mzk0TDExLjQzMDcgMTkuMjMxOEMxMS40NzgxIDE5LjM2MjIgMTEuMzgxNSAxOS41MDAxIDExLjI0MjcgMTkuNTAwMUgxMC4yNDk2QzEwLjE2NTUgMTkuNTAwMSAxMC4wOTAzIDE5LjQ0NzUgMTAuMDYxNiAxOS4zNjg1TDkuMzIyIDE3LjMzNDNINi42NzkzN0w1LjkzOTM4IDE5LjM2ODVDNS45MTA2MyAxOS40NDc1IDUuODM1NTIgMTkuNTAwMSA1Ljc1MTQzIDE5LjUwMDFINC43NTgyM0M0LjYxOTQzIDE5LjUwMDEgNC41MjI4MyAxOS4zNjIyIDQuNTcwMjggMTkuMjMxOEw3LjA0MTI2IDEyLjQzOTNMNy4xNTI5OSAxMi4xMzIxWk04LjAwMTAzIDEzLjcwMTJMOC44MzcyMSAxNi4wMDFINy4xNjQ0MUw4LjAwMTAzIDEzLjcwMTJaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K");
                }`,
                `@-webkit-keyframes ytr-spin {
                    0%  {-webkit-transform: rotate(0deg);}
                    100% {-webkit-transform: rotate(360deg);}
                }`
            ];
        }
    }
    
    /**
     * @typedef MainImageTrackerOptions
     * @type {Object}
     */
    
    /**
     * @typedef MainImageWeightCoefs
     * @type {Object}
     */
    
    /**
     * @typedef MainImageMaxValues
     * @type {Object}
     */
    
    /**
     * @typedef MainImageData
     * @type {Object}
     */
    
    /**
     * @typedef MainImageScoresData
     * @type {Object}
     */
    
    class MainImageTracker {
        options = /** @lends MainImageTrackerOptions# */{
            trackingInterval: 2000, // ms
            scrollingDebounce: 1000, // ms
            nativeButtonHeight: 30, // px
            minimalClientWidth: 256, // px
            minimalClientHeight: 144, // px
            minimalClientArea: 256 * 144, // px
            filterNoNativeButton: true,
            useTextDetection: true,
            $root: doc.documentElement,
        };
    
        weightCoefs = /** @lends MainImageWeightCoefs# */{
            coefX: 10,
            coefY: 5,
            visibleArea: 26,
            visibleAreaRatio: 12,
            nativeButtonFits: 12,
            activeMainImage: 8,
        };
    
        $mainImage = null;
    
        /** @type {(function($image: HTMLImageElement): Boolean) | null} */
        _filter = null;
        _trackingInterval;
        _active = false;
        _imageChangedHandlers = [];
        _ignoredImages = [];
    
        /**
         * @param {MainImageTrackerOptions|Object} options
         * @param {MainImageWeightCoefs|Object} weightCoefs
         */
        constructor(options, weightCoefs) {
            this.options = Object.assign(this.options, options);
            this.weightCoefs = Object.assign(this.weightCoefs, weightCoefs);
    
            this._updateMainImageAsync = debounce(() => this._updateMainImage());
    
            this._listenScroll();
            this._startTrackingInterval();
        }
    
        /**
         * Adds images to ignore list
         * @param {HTMLImageElement} $image
         */
        ignoreImage($image) {
            this._ignoredImages.push($image);
        }
    
        startTracking() {
            this._active = true;
            this._updateMainImage().then(x => void x);
            return this;
        }
    
        stopTracking() {
            this._active = false;
            return this;
        }
    
        /**
         * @param {function($image: HTMLImageElement): Boolean} filter
         * @return {MainImageTracker}
         */
        setImageFilter(filter) {
            this._filter = filter;
            return this;
        }
    
        /**
         * @param {function($image: HTMLImageElement|null): Boolean} handler
         * @return {MainImageTracker}
         */
        onMainImageChanged(handler) {
            this._imageChangedHandlers.push(handler);
            return this;
        }
    
        async isImageWithText($img) {
            const status = await ImageTranslator.getImageTextDetectionStatus($img);
    
            return [
                TextDetectionStatuses.SOFT_TEXT,
                TextDetectionStatuses.STRONG_TEXT,
                TextDetectionStatuses.NOT_IMPLEMENTED,
            ].includes(status);
        }
    
        _listenScroll() {
            win.addEventListener('scroll', debounce(() => {
                if (this._active) {
                    this._updateMainImageAsync();
                }
            }, this.options.scrollingDebounce));
        }
    
        _startTrackingInterval() {
            this._trackingInterval = setInterval(() => {
                this._updateMainImageAsync();
            }, this.options.trackingInterval);
        }
    
        async _updateMainImage() {
            if (!this._active) {
                return;
            }
    
            let $mainImage;
    
            if (this.options.useTextDetection) {
                $mainImage = await this._findMainImageWithText();
            } else {
                $mainImage = this._findMainImage();
            }
    
            if ($mainImage === this.$mainImage) {
                return;
            }
    
            this.$mainImage = $mainImage;
    
            this._imageChangedHandlers.forEach((handler) => {
                try {
                    handler($mainImage);
                } catch (e) {}
            });
        }
    
        async _findMainImageWithText() {
            return new Promise((resolve) => {
                const nextImage = async () => {
                    const $img = this._findMainImage();
    
                    if (!$img) {
                        return resolve(null)
                    }
    
                    const hasText = await this.isImageWithText($img);
    
                    if (hasText) {
                        resolve($img)
                    } else {
                        this.ignoreImage($img);
                        await nextImage();
                    }
                };
    
                nextImage();
            });
        }
    
        _findMainImage() {
            const imagesData = this._getViewportImagesData();
    
            const maxValues = /** @lends MainImageMaxValues# */{
                coefX: 0,
                coefY: 0,
                visibleArea: 0,
            }
    
            imagesData.forEach((imgData) => {
                maxValues.coefX = Math.max(maxValues.coefX, imgData.coefX);
                maxValues.coefY = Math.max(maxValues.coefY, imgData.coefY);
                maxValues.visibleArea = Math.max(maxValues.visibleArea, imgData.visibleArea);
            });
    
            let bestImageData = null;
            let bestScore = 0;
    
            imagesData.forEach((imgData) => {
                imgData.scoreData = this._calcImageDataScores(imgData, maxValues);
                imgData.totalScore = this._calcTotalScore(imgData, imgData.scoreData);
    
                if (imgData.totalScore > bestScore) {
                    bestImageData = imgData;
                    bestScore = imgData.totalScore;
                }
            });
    
            return bestImageData && bestImageData.$image || null;
        }
    
        /**
         * @param {MainImageData|Object} imgData
         * @param {MainImageMaxValues|Object} maxValues
         * @returns {MainImageScoresData|Object}
         */
        _calcImageDataScores(imgData, maxValues) {
            const calcScore = (value, maxValue) => {
                return maxValue && value / maxValue;
            };
    
            return /** @lends MainImageScoresData# */{
                coefX: calcScore(imgData.coefX, maxValues.coefX),
                coefY: calcScore(imgData.coefY, maxValues.coefY),
                visibleArea: calcScore(imgData.visibleArea, maxValues.visibleArea),
                nativeButtonFits: imgData.nativeButtonFits ? 1 : 0,
                visibleAreaRatio: imgData.visibleAreaRatio,
                activeMainImage: imgData.$image === this.$mainImage ? imgData.visibleAreaRatio : 0,
            };
        }
    
        /**
         * @param {MainImageData|Object} imgData
         * @param {MainImageScoresData} scoreData
         * @returns {Number}
         */
        _calcTotalScore(imgData, scoreData) {
            let totalWeight = 0;
            let maxWeight = 0;
    
            for(const k in this.weightCoefs) {
                if (!this.weightCoefs.hasOwnProperty(k)) {
                    continue;
                }
    
                const weight = this.weightCoefs[k];
    
                if (scoreData.hasOwnProperty(k)) {
                    totalWeight += scoreData[k] * weight;
                }
    
                maxWeight += weight;
            }
    
            return totalWeight / maxWeight;
        }
    
        _getViewportImagesData() {
            return this._getRootImages()
                .filter(($img) => {
                    return this._ignoredImages.indexOf($img) === -1;
                })
                .filter(($img) => {
                    return ImageController.isOriginalImage($img);
                })
                .filter(($img) => {
                    const { clientWidth, clientHeight } = $img;
                    return clientWidth >= this.options.minimalClientWidth &&
                        clientHeight >= this.options.minimalClientHeight &&
                        clientWidth * clientHeight >= this.options.minimalClientArea;
                })
                .filter(($img) => {
                    return !this._filter || this._filter($img);
                })
                .map(($image) => {
                    const rect = $image.getBoundingClientRect();
                    const visibleArea = HtmlElement.getRectVisibleArea(rect);
                    const visibleAreaRatio = visibleArea / (rect.width * rect.height);
                    const { x: coefX, y: coefY } = MainImageTracker.getRectPositionCoefs(rect);
                    const nativeButtonFits = this._isNativeButtonFits(rect);
    
                    return /** @lends MainImageData# */{
                        $image,
                        rect,
                        coefX,
                        coefY,
                        visibleArea,
                        visibleAreaRatio,
                        nativeButtonFits,
                    };
                })
                .filter(({ nativeButtonFits }) => {
                    return nativeButtonFits || !this.options.filterNoNativeButton;
                })
                .filter(({ visibleArea, $image }) => {
                    return visibleArea && HtmlElement.isElementTranslatable($image);
                });
        }
    
        _getRootImages() {
            return Array.from(this.options.$root.querySelectorAll('img'));
        }
    
        _isNativeButtonFits(rect) {
            const $doc = doc.documentElement;
            const viewportHeight = win.innerHeight || $doc.clientHeight;
    
            const bottomOffset = viewportHeight - rect.top;
    
            return rect.top > -this.options.nativeButtonHeight &&
                bottomOffset > this.options.nativeButtonHeight;
        }
    
        /**
         * @param {DOMRect} rect
         * @returns {{x: Number, y: Number}}
         */
        static getRectPositionCoefs(rect) {
            const $doc = doc.documentElement;
            const viewportWidth = win.innerWidth || $doc.clientWidth;
            const viewportHeight = win.innerHeight || $doc.clientHeight;
    
            const leftOffset = rect.left;
            const topOffset = rect.top;
            const rightOffset = viewportWidth - rect.right;
            const bottomOffset = viewportHeight - rect.bottom;
    
            const x = (leftOffset + rightOffset) / Math.max(leftOffset, rightOffset) / 2;
            const y = (topOffset + bottomOffset) / Math.max(topOffset, bottomOffset) / 2;
    
            return { x, y };
        }
    }
    
    class Bezier {
        static getEdgesCoords(box, pathData) {
            const { startPoint, width, hh } = pathData;
    
            const leftX = startPoint;
            const rightX = startPoint + width;
            const middleX = (leftX + rightX) / 2;
            const halfPath = hh * 0.6;
    
            const getY = (x) => {
                return this.getCubicFunctionValue(x, box.polyCoefs);
            };
    
            return {
                top: { x: middleX, y: getY(middleX) - halfPath },
                right: { x: rightX, y: getY(rightX) },
                bottom: { x: middleX, y: getY(middleX) + halfPath },
                left: { x: leftX, y: getY(leftX) },
            };
        }
    
        static getBoxPath(box, pathData) {
            const points = this.constructPoints(pathData, box.polyCoefs);
    
            return points.map(({x, y}, i) => {
                if (i === 0) {
                    return pathData.flip ?
                        `M ${y.toFixed(2)}, ${x.toFixed(2)}` :
                        `M ${x.toFixed(2)}, ${y.toFixed(2)}`;
                }
                return this.getBezierFragment(points[i], i, points, pathData);
            }).join('');
        }
    
        static constructPoints({ startPoint, width }, polyCoefs) {
            const steps = this.getStepsAmount(polyCoefs);
            const points = [];
            const step = width / steps;
    
            for (let i = 0; i <= steps; i++) {
                const x = startPoint + step * i;
                points.push({ x, y: this.getCubicFunctionValue(x, polyCoefs) });
            }
    
            return points;
        }
    
        static getStepsAmount({ a2, a3 }) { // mediocre hack to reduce bezier points
            if (!a2 && !a3) return 1;
            if (a2 && !a3) return 3;
            return 5;
        }
    
        static getCubicFunctionValue(x, { a0, a1, a2, a3 }) {
            return a3 * Math.pow(x, 3) + a2 * Math.pow(x, 2) + a1 * x + a0;
        }
    
        static getBezierFragment(point, index, points, { flip }) {
            const start = this.getControlPoint(points[index - 1], points[index - 2], point, false);
            const end = this.getControlPoint(point, points[index - 1], points[index + 1], true);
    
            return flip ?
                ` C ${start.y},${start.x} ${end.y},${end.x} ${point.y.toFixed(2)},${point.x.toFixed(2)}` :
                ` C ${start.x},${start.y} ${end.x},${end.y} ${point.x.toFixed(2)},${point.y.toFixed(2)}`;
        }
    
        static getControlPoint(current, previous, next, reverse) {
            const SMOOTHING = 0.1;
            const updatedPrevious = previous || current;
            const updatedNext = next || current;
            const currentLine = this.getLineFromPoints(updatedPrevious, updatedNext);
            const currentAngle = currentLine.angle + (reverse ? Math.PI : 0);
            const currentLength = currentLine.length * SMOOTHING;
    
            return {
                x: (current.x + Math.cos(currentAngle) * currentLength).toFixed(2),
                y: (current.y + Math.sin(currentAngle) * currentLength).toFixed(2),
            };
        }
    
        static getLineFromPoints(first, second) {
            const lengthX = second.x - first.x;
            const lengthY = second.y - first.y;
    
            return {
                length: Math.sqrt(Math.pow(lengthX, 2) + Math.pow(lengthY, 2)),
                angle: Math.atan2(lengthY, lengthX),
            };
        }
    }
    
    class CustomHooks {
        static hostname = String(doc.location.hostname).replace('www.', '');
        static pathname = String(doc.location.pathname);
    
        static isYndxImg() {
            return /^yandex(?:\.[a-z]+){1,2}$/.test(this.hostname) &&
                this.pathname.indexOf('/images') === 0;
        }
    
        static useSoftSwap() {
            return this.isYndxImg() ||
                /(?:^|\.)taobao.com$/.test(this.hostname);
        }
    
        static afterBgReplace(imgCtrl, $targetImg) {
    
        }
    
        static afterSrcReplace(imgCtrl, $targetImg) {
            if (!$targetImg || !$targetImg.parentNode) {
                return;
            }
    
            try {
                if (this.isYndxImg()) {
                    this.fixYndxImg($targetImg);
                }
            } catch (e) {}
    
        }
    
        static afterReplace(imgCtrl, $newImage, $prevImage) {
            if (!$newImage || !$newImage.parentNode) {
                return;
            }
    
            const { hostname } = this;
    
            try {
                if (hostname === 'twitter.com') {
                    this.checkNeighborsBg($newImage);
                } else if (/^amazon(?:\.[a-z]+){1,2}$/.test(hostname)) {
                    this.patchAmazon($newImage);
                }
            } catch (e) {}
        }
    
        static setSrcset($newImage) {
            $newImage.setAttribute('srcset', $newImage.src);
        }
    
        static checkNeighborsBg($newImage) {
            const $$children = Array.from($newImage.parentNode.children);
    
            for (const $child of $$children) {
                if ($child === $newImage) {
                    continue;
                }
    
                const style = win.getComputedStyle($child);
    
                if (style.backgroundImage && style.backgroundImage !== 'none') {
                    $child.style.backgroundImage = `url(${$newImage.src})`;
                }
            }
        }
    
        static patchAmazon($newImage) {
            this.setSrcset($newImage);
            $newImage.setAttribute('data-a-hires', $newImage.src);
        }
    
        static fixOpacity($newImage) {
            $newImage.style.opacity = '1';
        }
    
        static fixYndxImg($targetImage) {
            const $$parentImages = Array.from(
                $targetImage.parentNode.querySelectorAll('img'));
    
            if ($$parentImages.length !== 2) {
                return;
            }
    
            for (const $img of $$parentImages) {
                if ($img.src === $targetImage.src) {
                    continue;
                }
    
                $img.src = $targetImage.src;
            }
        }
    }
    
    function isBgLoaded($el) {
        return Boolean(
            $el[OrigImage.$YTR_LINKED_IMG] &&
            isImageLoaded($el[OrigImage.$YTR_LINKED_IMG]));
    }
    
    function isImageLoaded($image) {
        return Boolean($image.naturalHeight);
    }
    
    async function waitImageLoaded($image, timeout = 30000) {
        if ($image.naturalHeight) {
            return true;
        }
    
        return Promise.race([
            new Promise((resolve, reject) => {
                $image.addEventListener('load', () => resolve());
                $image.addEventListener('error', (e) => reject(new ImageLoadingError(e)));
            }),
            new Promise((_, reject) => setTimeout(() => {
                reject(new ImageLoadingTimeoutError());
            }, timeout))
        ]);
    }
    
    async function wait(time = 50) {
        return new Promise((resolve) => setTimeout(() => resolve(), time));
    }
    
    function getElementBgUrl($el) {
        return getElementComputedBgUrl($el);
    }
    
    function getElementComputedBgUrl($el) {
        const bg = window.getComputedStyle($el).backgroundImage;
        return bg && bg !== 'none' ? parseBgUrl(bg) : null;
    }
    
    function getElementStyleAttrBgUrl($el) {
        const bg = $el.style.background || $el.style.backgroundImage;
        return bg ? parseBgUrl(bg) : null;
    }
    
    function parseBgUrl(bg) {
        const matches = /^url\((?:['"]?)([^'"]*)(?:['"]?)\)$/.exec(bg);
        return matches && matches[1];
    }
    
    function normalizeUrl(url) {
        let path = url;
    
        if (path.indexOf('data:') === 0) {
            return path;
        } else if (path.indexOf('blob:') === 0) {
            return path;
        }
    
        const { protocol, origin, pathname } = location;
    
        if (path.slice(0, 2) === '//') { // //domain.com/cdn/images/img.jpg
            path = protocol + path;
        } else if (path[0] === '/') { // /cdn/images/img.jpg
            path = origin + path;
        } else if (path.indexOf('://') === -1) { // images/img.jpg
            const absPath = pathname.split('/').slice(1, -1).join('/');
            path = origin + absPath + '/' + path;
        }
    
        try {
            return (new URL(path)).href;
        } catch (e) {}
    
        return null;
    }
    
    function makeUrl(url, params = {}) {
        return url + (Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '');
    }
    
    function formData(data) {
        const fd = new FormData();
    
        for(const key in data) {
            if (data.hasOwnProperty(key)) {
                fd.append(key, data[key]);
            }
        }
    
        return fd;
    }
    
    function fetchWithTimeout(url, options, timeout = 10000) {
        return Promise.race([
            fetch(url, options),
            new Promise((_, reject) => setTimeout(() => reject(new ApiTimeoutError()), timeout))
        ]);
    }
    
    function calcMedian(values) {
        if (!values.length) {
            return null;
        }
    
        values.sort((a, b) => a - b);
    
        const middle = Math.floor(values.length / 2);
    
        if (values.length % 2) {
            return values[middle];
        }
    
        return (values[middle - 1] + values[middle]) / 2;
    }
    
    function getAvg(arr) {
        return Math.round(arr.reduce((ac, v) => ac + v, 0) / arr.length);
    }
    
    function groupValues(values, maxDelta) {
        if (values.length < 2) return values;
    
        const avg = getAvg(values);
    
        const res = [];
        const left = [];
        const right = [];
        const middle = [];
    
        values.forEach((x) => {
            if (x <= avg - maxDelta) {
                left.push(x);
            } else if (x >= avg + maxDelta) {
                right.push(x);
            } else {
                middle.push(x);
            }
        });
    
        if (middle.length) {
            res.push(getAvg(middle));
        }
        if (left.length) {
            res.unshift(...groupValues(left, maxDelta));
        }
        if (right.length) {
            res.push(...groupValues(right, maxDelta));
        }
    
        return res;
    }
    
    function pickBestValue(base, groups, maxDelta) {
        for (let i = 0; i < groups.length; i++) {
            const bl = groups[i];
            if (base > bl - maxDelta && base < bl + maxDelta) {
                return bl;
            }
        }
    
        return base;
    }
    
    function debounce(callback, delay = 0) {
        let timeout;
    
        return function() {
            clearTimeout(timeout);
    
            timeout = setTimeout(() => {
                callback(...arguments);
            }, delay);
        };
    }
    
    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
    
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
    
        let h, s;
        const l = (max + min) / 2;
    
        if(max === min) {
            h = s = 0; // achromatic
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch(max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
    
        return [Math.floor(h * 360), Math.floor(s * 100), Math.floor(l * 100)];
    }
    
    function hslToRgb(h, s, l) {
        const l_ = l / 100;
        const a = s * Math.min(l_, 1 - l_) / 100;
        const f = (n) => {
            const k = (n + h / 30) % 12;
            const color = l_ - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color);
        };
    
        return [f(0), f(8), f(4)];
    }
    
    function isFirefox() {
        return win.navigator.userAgent.includes('Firefox');
    }
    
    function escapeHtml(html) {
        return String(html).replace(/["'<>]/g, (c) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            '\'': '&#39;',
        })[c]);
    }
    
    function removeArrayElement(arr, el) {
        const pos = arr.indexOf(el);
        if (pos !== -1) {
            arr.splice(pos, 1);
        }
    }
    
    namespace.SessionOptions = SessionOptions;
    namespace.ImageTranslator = ImageTranslator;
    namespace.MainImageTracker = MainImageTracker;
    
    namespace.TextDetectionStatuses = TextDetectionStatuses;
    namespace.ImageControllerStatuses = ImageControllerStatuses;
    namespace.ImageTranslationReasons = ImageTranslationReasons;
    
    namespace.ImageTranslatorErrors = {
        ImageTranslationError,
        ProcessingError,
        ApiError,
        ImageError,
    
        ImageCspError,
        ImageTypeError,
        NotImageError,
        ImageSizeError,
        ImageLoadingError,
        ImageLoadingTimeoutError,
        ApiTimeoutError,
        RecognitionError,
        NoTextError,
        TranslationError,
        TranslationIsSameError,
    
        LocalTextDetectionError,
        NoTextLocalDetectionError,
        LocalTextDetectionUnknownError,
    };
    
    })(window, window.document, window.yt = window.yt || {});