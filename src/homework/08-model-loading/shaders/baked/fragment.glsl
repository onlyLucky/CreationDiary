uniform sampler2D uBakedDayTexture;
uniform sampler2D uBakedNightTexture;
uniform sampler2D uBakedNeutralTexture;
uniform sampler2D uLightMapTexture;

uniform float uNightMix;
uniform float uNeutralMix;

uniform vec3 uLightTvColor;
uniform float uLightTvStrength;

uniform vec3 uLightDeskColor;
uniform float uLightDeskStrength;

uniform vec3 uLightPcColor;
uniform float uLightPcStrength;

varying vec2 vUv;

// lighten blend mode
vec3 blendLighten(vec3 base, vec3 blend, float opacity) {
    return max(base, blend * opacity);
}

void main()
{
    vec3 bakedDayColor = texture2D(uBakedDayTexture, vUv).rgb;
    vec3 bakedNightColor = texture2D(uBakedNightTexture, vUv).rgb;
    vec3 bakedNeutralColor = texture2D(uBakedNeutralTexture, vUv).rgb;
    vec3 bakedColor = mix(mix(bakedDayColor, bakedNightColor, uNightMix), bakedNeutralColor, uNeutralMix);
    vec3 lightMapColor = texture2D(uLightMapTexture, vUv).rgb;

    float lightTvStrength = lightMapColor.r * uLightTvStrength;
    bakedColor = blendLighten(bakedColor, uLightTvColor, lightTvStrength);

    float lightPcStrength = lightMapColor.b * uLightPcStrength;
    bakedColor = blendLighten(bakedColor, uLightPcColor, lightPcStrength);

    float lightDeskStrength = lightMapColor.g * uLightDeskStrength;
    bakedColor = blendLighten(bakedColor, uLightDeskColor, lightDeskStrength);

    gl_FragColor = vec4(bakedColor, 1.0);
}