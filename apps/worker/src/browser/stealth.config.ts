import { chromium } from 'playwright-extra';
import StealthPlugin from 'playwright-extra-plugin-stealth';

chromium.use(StealthPlugin());

export { chromium };

