// Marketing-landing media (website only). The iOS app never shows the landing page, and its 26MB demo video must not be shipped in the app:
// build the iOS bundle with VUE_APP_NATIVE_BUILD=1 (npm run build:ios) and webpack drops the video file entirely; at runtime it is also skipped on native.
import { isNative } from '@/utils/platform';
const HERO_BG = 'https://flowbite.s3.amazonaws.com/docs/jumbotron/conference.jpg';
export const demoVideo = (process.env.VUE_APP_NATIVE_BUILD === '1' || isNative()) ? '' : require('@/assets/video.mp4');
export const heroStyle = isNative() ? {} : { backgroundImage: `url('${HERO_BG}')` };
