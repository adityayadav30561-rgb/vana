// Time of day, shared by every shader: morning light at the top of the page,
// golden hour through the middle, moonlight by the time Krishna is reached.
// uDusk warms the light; uNight darkens, cools and desaturates it.
export const TIME_GRADE = /* glsl */ `
  uniform float uNight; uniform float uDusk;
  vec3 timeGrade(vec3 c) {
    c *= mix(vec3(1.0), vec3(1.08, 0.92, 0.76), uDusk);
    float l = dot(c, vec3(0.3, 0.59, 0.11));
    vec3 moon = mix(vec3(l), c, 0.45) * vec3(0.52, 0.66, 0.95) * 0.47;
    return mix(c, moon, uNight);
  }
`;
