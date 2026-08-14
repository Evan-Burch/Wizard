import $ from 'jquery';

export function fadeInFelt(el: HTMLElement) {
  const $el = $(el);
  $el.stop(true).css({ opacity: 0.35 }).animate({ opacity: 1 }, 600);
}

export function slideInWonStack(el: HTMLElement) {
  const $el = $(el);
  $el.stop(true).css({ opacity: 0, marginTop: 8 }).animate({ opacity: 1, marginTop: 0 }, 450);
}

export function pulseBid(el: HTMLElement) {
  const $el = $(el);
  $el.stop(true, true).removeClass('bid-pulse');
  void $el[0].offsetWidth;
  $el.addClass('bid-pulse');
  window.setTimeout(() => $el.removeClass('bid-pulse'), 700);
}

export function animateOverlayIn(el: HTMLElement) {
  const $el = $(el);
  $el.stop(true).css({ opacity: 0 }).animate({ opacity: 1 }, 250);
}

export function animatePopupIn(el: HTMLElement) {
  const $el = $(el);
  $el.stop(true).css({ opacity: 0, marginTop: 24 }).animate({ opacity: 1, marginTop: 0 }, 320);
}

export function animateScoreboardIn(el: HTMLElement) {
  const $el = $(el);
  $el.stop(true).css({ opacity: 0 }).animate({ opacity: 1 }, 400);
}
