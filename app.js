const { DateTime, Duration } = require('luxon');

const plan_start = DateTime.fromISO('2017-12-16T10:00:00');
const MIN_DURATION = Duration.fromISO('PT30M').as('milliseconds');

// if you're going to supply a start or end time, you must specify a maximum duration
// you can supply just a duration and we'll fit it into your schedule based on order
// no duration: it can go anywhere you have a free 15 minutes

const plan = [{
  name: 'get dressed, shower',
  duration: Duration.fromISO('PT20M'),
  start_time: plan_start
}, {
  name: 'meet kevin for breakfast',
  start_time: DateTime.fromISO('2017-12-16T11:00:00')
}, {
  name: 'commute',
  start_time: DateTime.fromISO('2017-12-16T12:30:00'),
  duration: Duration.fromISO('PT15M')
}, {
  name: 'mockup of site',
  duration: Duration.fromISO('PT1H')
}, {
  name: 'convert PSD assets to html',
  duration: Duration.fromISO('PT1H30M')
}, {
  name: 'convert html mockup to wordpress theme',
  duration: Duration.fromISO('PT2H')
}, {
  name: 'eat dinner',
  start_time: DateTime.fromISO('2017-12-16T18:00:00')
}];

const items_with_start_times = plan.filter(item => item.start_time);
const items_with_end_times = plan.filter(item => item.end_time);
const items_with_durations = plan.filter(item => item.duration);
const items_without_derived_durations = plan.filter(item => !item.duration && !(item.start_time && item.end_time));

// compute average duration of items, use MIN_DURATION by default
const average_duration_ms = items_with_durations.length ? items_with_durations
  .map(item => item.duration.as('milliseconds'))
  .reduce((total, duration) => total + duration, 0) / items_with_durations.length : MIN_DURATION;
const average_duration = Duration.fromMillis(average_duration_ms);

for (var item of items_without_derived_durations) {
  item.duration = average_duration;
}

for (var item of items_with_start_times) {
  if (item.duration && !item.end_time) {
    item.end_time = item.start_time.plus(item.duration);
  }

  if (!item.duration && item.end_time) {
    item.duration = item.end_time.diff(item.start_time);
  }
}

for (var item of items_with_end_times) {
  if (item.duration && !item.start_time) {
    item.start_time = item.end_time.minus(item.duration);
  }

  if (!item.duration && item.start_time) {
    item.duration = item.end_time.diff(item.start_time);
  }
}

let schedule = plan.filter(item => item.start_time || item.end_time);
let unscheduled = plan.filter(item => !item.start_time && !item.end_time);


// schedule the rest of it, fill in the blanks
// unscheduled list is FIFO, so shift them out
// look at each interval and see if next item can fit
while (unscheduled.length) {
  let to_schedule = unscheduled.shift();

  const [first_item] = schedule;

  // CASE 0: no items in schedule
  if (!schedule.length) {
    to_schedule.start_time = plan_start;
    to_schedule.end_time = to_schedule.start_time.plus(to_schedule.duration);
    schedule = [to_schedule];
  }

  // CASE 1: one item in schedule
  if (schedule.length === 1) {
    if (to_schedule.duration.as('minutes') < first_item.start_time.diff(plan_start).as('minutes')) {
      to_schedule.start_time = plan_start;
      // can maybe do some magic with duration here to "expand" or "contract"
      // it if we have set it to the "canned" average task duration?
      to_schedule.end_time = to_schedule.start_time.plus(to_schedule.duration);
      schedule.unshift(to_schedule);
    } else {
      schedule.push(to_schedule);
    }
  }

  // CASE 2: more than one item in schedule
  if (schedule.length > 1) {
    for (var i = 0; i < schedule.length; i++) {
      const current_item = schedule[i];
      const next_item = schedule[i + 1];

      // CASE 2.0: attempt to fit between plan start and first task
      if (!i && to_schedule.duration.as('minutes') < current_item.start_time.diff(plan_start).as('minutes')) {
        to_schedule.start_time = plan_start;
        to_schedule.end_time = plan_start.plus(to_schedule.duration);
        schedule.unshift(to_schedule);
        break;
      } 
  
      // CASE 2.1: attempt to fit between current and next items
      if (current_item && next_item) {
        if (to_schedule.duration.as('minutes') < next_item.start_time.diff(current_item.end_time).as('minutes')) {
          to_schedule.start_time = current_item.end_time;
          to_schedule.end_time = to_schedule.start_time.plus(to_schedule.duration);
          schedule = [...schedule.slice(0, i+1), to_schedule, ...schedule.slice(i+1, schedule.length)];
          break;
        }
      }

      // CASE 2.2: fit at end of plan
      if (!next_item) {
        to_schedule.start_time = current_item.end_time;
        to_schedule.end_time = to_schedule.start_time.plus(to_schedule.duration);
        schedule.push(to_schedule);
        break;
      }
    }
  }
}

console.log(schedule.map(item => ({
  name: item.name,
  duration: item.duration ? item.duration.as('minutes') : '',
  start_time: item.start_time ? item.start_time.toString() : '',
  end_time: item.end_time ? item.end_time.toString() : ''
})));
// // place all the ones with a start time
// let schedule = partial_schedule.filter(item => item.start_time);