import config from "@saas-maker/eslint-config/next";

export default [
  ...config,
  {
    ignores: [
      "landing-astro/**", ".pages-deploy/**",
      ".fallow/**",
      "extension/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
];
