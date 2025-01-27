var beatbox = {
  setup: function () {
    p5.disableFriendlyErrors = true
    beatbox.canvas.setup()
    beatbox.song.setup()
    beatbox.interactivity.setup()
  },
  draw: function () {
    beatbox.song.fft.analyze()
    beatbox.canvas.draw()
    beatbox.interactivity.draw()
  },
  song: {
    p5Song: {},
    amp: new p5.Amplitude(),
    fft: new p5.FFT(0.9, 128),
    isLoaded: false,
    isLoading: false,
    isMuted: false,
    duration: 0,
    position: 0,
    positionAutoUpdate: true,
    skipRate: 10, // Number of seconds to skip forward or back,
    maxVolume: 1,
    currentVolume: 1,
    setup: function () { beatbox.song.p5Song = loadSound("sounds/Sunrise.mp3", beatbox.song.onSongLoaded, beatbox.song.onSongLoadFail, beatbox.song.onSongLoading) },
    onSongLoaded: function () {
      beatbox.song.isLoaded = true
      beatbox.song.isLoading = false
      beatbox.song.duration = beatbox.song.p5Song.duration()
      beatbox.song.loadCurrentVolume()
      select('.PlayButton').mousePressed(beatbox.song.togglePlayback)
      select('.MuteButton').mousePressed(beatbox.song.toggleMute)

      let angleMultiplierSlider = createSlider(1.5, 10, 8, 0)
      angleMultiplierSlider.class("angleMultiplierSlider")
      select('#angleMultiplierDiv').child(angleMultiplierSlider)

      let indexMultiplierSlider = createSlider(0.5, 1.5, 1, 0)
      indexMultiplierSlider.class("indexMultiplierSlider")
      select('#indexMultiplierDiv').child(indexMultiplierSlider)

      let heightDividerSlider = createSlider(2.5, 4, 3, 0)
      heightDividerSlider.class("heightDividerSlider")
      select('#heightDividerDiv').child(heightDividerSlider)

      let songPositionSlider = createSlider(0, beatbox.song.p5Song.duration(), 0, 1)
      songPositionSlider.style("width", beatbox.canvas.width + "px")
      songPositionSlider.class('songPositionSlider')
      select('.musicSliderList').child(songPositionSlider)

      let volumeSlider = createSlider(0, 100, beatbox.song.currentVolume, 1)
      volumeSlider.style("width", beatbox.canvas.width + "px")
      volumeSlider.class('volumeSlider')
      volumeSlider.mouseReleased(beatbox.song.saveCurrentVolume)
      select('.musicSliderList').child(volumeSlider)
    },
    onSongLoadFail: function () {
      beatbox.song.isLoading = false
      printMessage("Song failed to load")
    },
    onSongLoading: function () { beatbox.song.isLoading = true },
    onSongEnd: function () { select('.PlayButton').html("Play") },
    togglePlayback: function () {
      if (beatbox.song.isLoading) { return }
      if (beatbox.song.p5Song.isPlaying()) {
        select('.PlayButton').html("Play")
        beatbox.song.position = beatbox.song.p5Song.currentTime()
        beatbox.song.p5Song.pause()
      }
      else {
        select('.PlayButton').html("Pause")
        beatbox.song.p5Song.play()
        let volume = beatbox.song.isMuted ? 0 : beatbox.song.currentVolume / 100
        beatbox.song.p5Song.setVolume(volume)
        beatbox.song.p5Song.onended(beatbox.song.onSongEnd)
      }
    },
    toggleMute: function () {
      if (beatbox.song.isMuted) {
        select('volumeSlider').value(beatbox.song.currentVolume)
        beatbox.song.p5Song.setVolume(beatbox.song.currentVolume / 100)
        select('.muteButton').html("Mute")
      }
      else {
        select('volumeSlider').value(0)
        beatbox.song.p5Song.setVolume(0)
        select('.muteButton').html("Unmute")
      }
      beatbox.song.isMuted = !beatbox.song.isMuted
    },
    saveCurrentVolume: function () { storeItem("currentVolume", select('volumeSlider').value()) },
    loadCurrentVolume: function () {
      beatbox.song.currentVolume = getItem("currentVolume")
      if (beatbox.song.currentVolume === null) { beatbox.song.currentVolume = beatbox.song.maxVolume }
    },
  },
  canvas: {
    width: 1200,
    height: 800,
    p5Canvas: {},
    lowEnergy: {},
    highEnergy: {},
    totalEnergy: {},
    colorHue: {},
    colorSaturation: {},
    colorBrightness: {},
    background: {
      enabled: false,
      redraw: true, // When false, previous frames aren't overwritten. Set to true for 'colorful' bg.
      reset: function () { background(0, 0, 0) },
      draw: function () {
        if (beatbox.canvas.background.redraw) {
          beatbox.canvas.background.reset()
          for (let i = 0; i < beatbox.canvas.spectrogram.nodes.length; i++) {
            stroke(beatbox.canvas.background.enabled ? beatbox.canvas.spectrogram.nodes[i].color : [0, 0, 0])
            line(i, 0, i, beatbox.canvas.height)
          }
        }
      },
    },
    spectrogram: {
      enabled: false,
      nodes: [],
      setup: function () {
        beatbox.canvas.spectrogram.nodes = new Array(beatbox.canvas.width).fill({
          volume: beatbox.song.maxVolume / 2,
          color: [0, 0, 0],
        })
      },
      draw: function () {
        let volume = beatbox.song.p5Song.isPlaying() ? beatbox.song.amp.getLevel() : beatbox.song.maxVolume / 2
        let color = beatbox.song.p5Song.isPlaying() ? [beatbox.canvas.colorHue, beatbox.canvas.colorSaturation, beatbox.canvas.colorBrightness] : [0, 0, 0]
        beatbox.canvas.spectrogram.nodes.push({ volume: volume, color: color })
        if (beatbox.canvas.spectrogram.enabled) {
          noFill()
          beginShape()
          for (let i = 0; i < beatbox.canvas.spectrogram.nodes.length; i++) {
            let y = map(beatbox.canvas.spectrogram.nodes[i].volume, 0, beatbox.song.maxVolume, beatbox.canvas.height * 0.6, beatbox.canvas.height * 0.4)
            let oppositeHue = beatbox.canvas.colorHue + 50
            if (oppositeHue > 99) { oppositeHue %= 100 }
            stroke(oppositeHue, 100, 100)
            vertex(i, y)
          }
          endShape()
        }
        beatbox.canvas.spectrogram.nodes.splice(0, 1) // Remove the oldest soundHistoryNode from spectrogram
      },
    },
    fractal: {
      enabled: true,
      angleHistory: [],
      angleHistoryCount: 400, // Determines the smoothness of the fractal movement
      angleMultiplier: 5,
      indexMultiplier: 0.99,
      trunkSkip: 1, // Determines the number of branches to exclude from the beginning of the fractal
      heightDivider: 3, // Determines starting heights of fractals relative to window height
      rotateOffset: 0,
      colorResolution: 0,
      startingThickness: 5,
      minResolution: 25,
      setup: function () {
        beatbox.canvas.fractal.angleHistory = new Array(beatbox.canvas.fractal.angleHistoryCount).fill(0)
      },
      draw: function () {
        if (beatbox.canvas.fractal.enabled && beatbox.song.p5Song.isPlaying()) {
          beatbox.canvas.fractal.angleMultiplier = select('.angleMultiplierSlider').value()
          beatbox.canvas.fractal.indexMultiplier = select('.indexMultiplierSlider').value()
          beatbox.canvas.fractal.heightDivider = select('.heightDividerSlider').value()

          // TODO: find a way to normalize totalEnergy
          beatbox.canvas.fractal.colorResolution = map(beatbox.canvas.totalEnergy, 0, 255, 0, 50)
          // Average the current fractal angle with previous angles for a smoother transition
          let currentFractalAngle = map(beatbox.song.amp.getLevel(), 0, beatbox.song.currentVolume / 100, 0, PI)
          beatbox.canvas.fractal.angleHistory.push(currentFractalAngle)
          let fractalAngleAvg = 0
          for (let i = 0; i < beatbox.canvas.fractal.angleHistory.length; i++) { fractalAngleAvg += beatbox.canvas.fractal.angleHistory[i] }
          fractalAngleAvg /= beatbox.canvas.fractal.angleHistory.length
          beatbox.canvas.fractal.angleHistory.splice(0, 1)

          // TODO: draw both fractals at once for better performance
          stroke(beatbox.canvas.colorHue, 100, 100)

          // Draw bottom fractal
          push()
          translate(beatbox.canvas.width / 2, beatbox.canvas.height)
          beatbox.canvas.fractal.drawBranch(beatbox.canvas.height / beatbox.canvas.fractal.heightDivider, fractalAngleAvg, beatbox.canvas.colorHue, 0, beatbox.canvas.startingThickness)
          pop()

          // Draw top fractal
          push()
          translate(width / 2, 0)
          scale(1, -1)
          beatbox.canvas.fractal.drawBranch(beatbox.canvas.height / beatbox.canvas.fractal.heightDivider, fractalAngleAvg, beatbox.canvas.colorHue, 0, beatbox.canvas.startingThickness)
          pop()
        }
      },
      drawBranch: function (len, fractalAngle, branchColor, index, thickness) {
        stroke(branchColor, 100, 100)
        strokeWeight(thickness === 1 ? thickness : thickness--)
        if (index++ >= beatbox.canvas.fractal.trunkSkip) { line(0, 0, 0, -len) }
        // Offset the child branch a certain amount around the color wheel
        branchColor += beatbox.canvas.fractal.colorResolution
        if (branchColor > 99) { branchColor %= 100 }
        if (len > beatbox.canvas.fractal.minResolution) {
          translate(0, -len)

          let lengthModifier = len * 0.67
          let angleModifier = fractalAngle * beatbox.canvas.fractal.angleMultiplier / (index * beatbox.canvas.fractal.indexMultiplier)

          // Draw right branch
          push()
          rotate(fractalAngle)
          beatbox.canvas.fractal.drawBranch(lengthModifier, angleModifier, branchColor, index, thickness)
          pop()

          // Draw left branch
          push()
          rotate(-fractalAngle)
          beatbox.canvas.fractal.drawBranch(lengthModifier, angleModifier, branchColor, index, thickness)
          pop()
        }
      },
    },
    frameRateDisplay: {
      enabled: false,
      history: new Array(20).fill(1),
      draw: function () {
        if (beatbox.canvas.frameRateDisplay.enabled) {
          beatbox.canvas.frameRateDisplay.history.push(frameRate())
          let avgFr = 0
          for (let i = 0; i < beatbox.canvas.frameRateDisplay.history.length; i++) { avgFr += beatbox.canvas.frameRateDisplay.history[i] }
          avgFr /= beatbox.canvas.frameRateDisplay.history.length
          textAlign(LEFT)
          fill(100, 0, 100)
          stroke(0, 100, 0)
          textSize(12)
          text("FPS: " + avgFr.toFixed(2), 10, beatbox.canvas.height - 10)
          beatbox.canvas.frameRateDisplay.history.splice(0, 1)
        }
      },
    },
    setup: function () {
      colorMode(HSB, 100)
      beatbox.canvas.width = windowWidth - 100
      beatbox.canvas.height = windowHeight - 150
      beatbox.canvas.p5Canvas = createCanvas(beatbox.canvas.width, beatbox.canvas.height)
      beatbox.canvas.p5Canvas.mousePressed(beatbox.song.togglePlayback)
      select('.mediaPlayer').child(beatbox.canvas.p5Canvas)
      beatbox.canvas.spectrogram.setup()
      beatbox.canvas.fractal.setup()
    },
    draw: function () {
      // Set color variables from volume and frequency info
      beatbox.canvas.highEnergy = beatbox.song.fft.getEnergy(10000, 15000)
      beatbox.canvas.colorHue = map(beatbox.canvas.highEnergy, 0, 100, 0, 100)
      beatbox.canvas.lowEnergy = beatbox.song.fft.getEnergy(40, 180)
      beatbox.canvas.colorSaturation = map(beatbox.canvas.lowEnergy, 0, 255, 50, 100)
      beatbox.canvas.totalEnergy = beatbox.song.fft.getEnergy(40, 15000)
      beatbox.canvas.colorBrightness = map(beatbox.canvas.totalEnergy, 0, 255, 0, 100)

      beatbox.canvas.background.draw()
      beatbox.canvas.spectrogram.draw()
      beatbox.canvas.fractal.draw()
      beatbox.canvas.frameRateDisplay.draw()
    },
    printMessage: function (message) {
      beatbox.canvas.background.reset()
      stroke(0, 0, 100)
      fill(0, 0, 100)
      textSize(60)
      textAlign(CENTER, CENTER)
      text(message, beatbox.canvas.width / 2, beatbox.canvas.height / 2)
    },
    setVisualElementsVisible(visible) {
      beatbox.canvas.background.enabled = visible
      beatbox.canvas.spectrogram.enabled = visible
      beatbox.canvas.fractal.enabled = visible
    },
  },
  interactivity: {
    timeSkipLength: 10,
    // This method exists to mitigate bugs caused by the jump() function
    // Shoutout to joepdooper on this thread for finding this solution:
    // https://github.com/processing/p5.js-sound/issues/372
    setup: function () {
      select('.FrameRateButton').mousePressed(() => beatbox.canvas.frameRateDisplay.enabled = !beatbox.canvas.frameRateDisplay.enabled)
    },
    draw: function () {
      if (beatbox.song.isLoaded) {
        if (beatbox.song.positionAutoUpdate) {
          if (beatbox.song.p5Song.isPlaying()) { select('.songPositionSlider').value(beatbox.song.p5Song.currentTime()) }
          else { select('.songPositionSlider').value(beatbox.song.position) }
        }
        if (beatbox.song.p5Song.isPlaying() && !beatbox.song.isMuted) {
          beatbox.song.currentVolume = select('.volumeSlider').value()
          beatbox.song.p5Song.setVolume(select('.volumeSlider').value() / 100)
        }
        else if (beatbox.song.isMuted && select('.volumeSlider').value() != 0) { beatbox.song.toggleMute() }
      }
    },
    preJump: function () {
      setTimeout(function () {
        Object.assign(beatbox.song.p5Song, { _playing: true })
        beatbox.song.p5Song.playMode("restart")
      }, 100)
      beatbox.song.p5Song.stop()
      beatbox.song.p5Song.playMode("sustain")
    },
    keyPressed: function () {
      let jumpToTime = 0
      switch (keyCode) {
        case LEFT_ARROW:
          jumpToTime = beatbox.song.p5Song.currentTime() - beatbox.interactivity.timeSkipLength
          if (jumpToTime > 0) {
            beatbox.interactivity.preJump()
            beatbox.song.p5Song.jump(jumpToTime)
          }
          else {
            beatbox.interactivity.preJump()
            beatbox.song.p5Song.jump(0)
          }
          beatbox.interactivity.konami.checkKonamiCode("LEFT")
          break
        case RIGHT_ARROW:
          jumpToTime = beatbox.song.p5Song.currentTime() + beatbox.interactivity.timeSkipLength
          if (jumpToTime < beatbox.song.duration) {
            beatbox.interactivity.preJump()
            beatbox.song.p5Song.jump(jumpToTime)
          }
          else { beatbox.song.p5Song.stop() }
          beatbox.interactivity.konami.checkKonamiCode("RIGHT")
          break
        case UP_ARROW:
          beatbox.interactivity.konami.checkKonamiCode("UP"); break
        case DOWN_ARROW:
          beatbox.interactivity.konami.checkKonamiCode("DOWN"); break
        case 65: // a
          beatbox.interactivity.konami.checkKonamiCode("A"); break
        case 66: // b
          beatbox.interactivity.konami.checkKonamiCode("B"); break
        case 32: // Spacebar
          beatbox.song.togglePlayback(); break
        default:
          beatbox.interactivity.konami.checkKonamiCode(""); break
      }
      return false // Prevent any default window behaviour
    },
    konami: {
      code: new Array(10).fill(""),
      checkKonamiCode: function (input) {
        beatbox.interactivity.konami.code.push(input)
        beatbox.interactivity.konami.code.splice(0, 1)
        if (input !== "A") { return }
        if (
          beatbox.interactivity.konami.code[0] === "UP" &&
          beatbox.interactivity.konami.code[1] === "UP" &&
          beatbox.interactivity.konami.code[2] === "DOWN" &&
          beatbox.interactivity.konami.code[3] === "DOWN" &&
          beatbox.interactivity.konami.code[4] === "LEFT" &&
          beatbox.interactivity.konami.code[5] === "RIGHT" &&
          beatbox.interactivity.konami.code[6] === "LEFT" &&
          beatbox.interactivity.konami.code[7] === "RIGHT" &&
          beatbox.interactivity.konami.code[8] === "B" &&
          beatbox.interactivity.konami.code[9] === "A"
        ) {
          beatbox.canvas.background.redraw = !beatbox.canvas.background.redraw
          beatbox.canvas.background.reset()
        }
      },
    },
  },
}

function setup() { beatbox.setup() }
function draw() { beatbox.draw() }
function keyPressed() { beatbox.interactivity.keyPressed() }
