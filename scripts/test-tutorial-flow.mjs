// Tutorial flow: Skip buttons sit mid-screen (not the top bar), tour Next pages one slide per tap, Back pages back one slide, wording.
import { readFileSync } from 'fs'; import assert from 'assert';
const c = readFileSync('src/components/onboarding/CoachSpotlight.vue', 'utf8'), w = readFileSync('src/views/WelcomeView.vue', 'utf8'), k = readFileSync('src/components/onboarding/TutorialCarousel.vue', 'utf8'), l = readFileSync('src/utils/coachLessons.js', 'utf8');
assert(/\.coach-actions\s*\{[^}]*top:\s*calc\(50%/.test(c) && /placeActions/.test(c), 'Skip row centred and kept clear of spotlight/caption');
assert(!/\.coach-actions\s*\{[^}]*top:\s*calc\(env/.test(c), 'no longer pinned to the top');
assert(/STEPS\[step\.value\] === 'tour' && slide\.value > 0\) \{ slide\.value -= 1; return; \}/.test(w), 'Back pages back inside the tour');
assert(!/slide\.value \+= 1;[^\n]*goTo\(/.test(w), 'Next scrolls once (via the carousel modelValue watch)');
assert(/Math\.abs\(el\.scrollLeft - target\) > 2/.test(k), 'carousel ignores mid-scroll positions until it arrives');
assert(!/hold my face for a second|This is I'm off\. Tap it\./.test(l), 'coach wording');
console.log('tutorial flow ok');
