var Triggerable = require('lib/triggerable')
var Param = require('lib/param')
var Property = require('observ-default')
var Transform = require('lib/param-transform')
var Apply = require('lib/apply-param')
var ParamClamp = require('lib/param-clamp')

var ScheduleEvent = require('lib/schedule-event')

module.exports = OscillatorNode

function OscillatorNode (context) {
  var output = context.audio.createGain()
  var amp = context.audio.createGain()
  var lastEvent = null
  amp.gain.value = 0
  amp.connect(output)

  var obs = Triggerable(context, {
    amp: Param(context, 1),
    frequency: Param(context, 440),
    noteOffset: Param(context, 0),
    octave: Param(context, 0),
    detune: Param(context, 0),
    shape: Property('sine') // Param(context, multiplier.gain, 1)
  }, trigger)

  obs.context = context

  var noteOffsetCents = toCents(add(
    add(obs.noteOffset, context.noteOffset),
    multiply(obs.octave, 12)
  ))

  var detune = add(noteOffsetCents, obs.detune)
  var powerRolloff = add(multiply(detune, -1 / 12800), 0.5) // TODO: improve this value?

  Apply(context, amp.gain, ParamClamp(obs.amp, 0, 10))

  obs.connect = output.connect.bind(output)
  obs.disconnect = output.disconnect.bind(output)

  obs.shape(function (value) {
    if (lastEvent && (!lastEvent.to || lastEvent.to > context.audio.currentTime)) {
      setShape(context, lastEvent.source, value)
    }
  })

  return obs

  // scoped
  function trigger (at) {
    var oscillator = context.audio.createOscillator()
    var power = context.audio.createGain()
    var choker = context.audio.createGain()
    oscillator.start(at)
    oscillator.connect(power)
    power.connect(choker)
    choker.connect(amp)
    setShape(context, oscillator, obs.shape())
    lastEvent = new ScheduleEvent(at, oscillator, choker, [
      Apply(context, power.gain, powerRolloff),
      Apply(context, oscillator.detune, detune),
      Apply(context, oscillator.frequency, obs.frequency)
    ])
    return lastEvent
  }
}

function setShape (context, target, value) {
  if (value !== target.lastShape) {
    if (context.periodicWaves && context.periodicWaves[value]) {
      target.setPeriodicWave(context.periodicWaves[value])
    } else {
      target.type = value
    }
    target.lastShape = value
  }
}

function toCents (param) {
  return Transform(param, 100, 'multiply')
}

function add (a, b) {
  return Transform(a, b, 'add')
}

function multiply (a, b) {
  return Transform(a, b, 'multiply')
}
