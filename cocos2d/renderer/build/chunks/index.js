module.exports = {
  "common": "\n\n\n\n\n#define PI 3.14159265359\n#define PI2 6.28318530718\n#define EPSILON 1e-6\n#define LOG2 1.442695\n\n\n#define saturate(a) clamp( a, 0.0, 1.0 )",
  "gamma-correction": "\n\n\n\nvec3 gammaToLinearSpaceRGB(vec3 sRGB) { \n  return sRGB * (sRGB * (sRGB * 0.305306011 + 0.682171111) + 0.012522878);\n}\n\nvec3 linearToGammaSpaceRGB(vec3 RGB) { \n  vec3 S1 = sqrt(RGB);\n  vec3 S2 = sqrt(S1);\n  vec3 S3 = sqrt(S2);\n  return 0.585122381 * S1 + 0.783140355 * S2 - 0.368262736 * S3;\n}\n\nvec4 gammaToLinearSpaceRGBA(vec4 sRGBA) {\n  return vec4(gammaToLinearSpaceRGB(sRGBA.rgb), sRGBA.a);\n}\n\nvec4 linearToGammaSpaceRGBA(vec4 RGBA) {\n  return vec4(linearToGammaSpaceRGB(RGBA.rgb), RGBA.a);\n}\n\n\nfloat gammaToLinearSpaceExact(float val) {\n  if (val <= 0.04045) {\n    return val / 12.92;\n  } else if (val < 1.0) {\n    return pow((val + 0.055) / 1.055, 2.4);\n  } else {\n    return pow(val, 2.2);\n  }\n}\n\nfloat linearToGammaSpaceExact(float val) {\n  if (val <= 0.0) {\n    return 0.0;\n  } else if (val <= 0.0031308) {\n    return 12.92 * val;\n  } else if (val < 1.0) {\n    return 1.055 * pow(val, 0.4166667) - 0.055;\n  } else {\n    return pow(val, 0.45454545);\n  }\n}",
  "packing": "\n\nvec4 packDepthToRGBA(float depth) {\n  vec4 ret = vec4(1.0, 255.0, 65025.0, 160581375.0) * depth;\n  ret = fract(ret);\n  ret -= ret.yzww * vec4(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 0.0);\n  return ret;\n}\n\nfloat unpackRGBAToDepth(vec4 color) {\n  return dot(color, vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 160581375.0));\n}",
  "pbr-fs": "\n\n#if USE_NORMAL_TEXTURE\n#extension GL_OES_standard_derivatives : enable\n#endif\n\n#if USE_TEX_LOD\n#extension GL_EXT_shader_texture_lod: enable\n#endif\n\n#include <common>\n#include <gamma-correction>\n\nstruct LightInfo {\n  vec3 lightDir;\n  vec3 radiance;\n};\n\n#if _NUM_DIR_LIGHTS > 0\n  #pragma for id in range(0, _NUM_DIR_LIGHTS)\n    uniform vec3 _dir_light{id}_direction;\n    uniform vec3 _dir_light{id}_color;\n  #pragma endFor\n#endif\n\n#if _NUM_POINT_LIGHTS > 0\n  #pragma for id in range(0, _NUM_POINT_LIGHTS)\n    uniform vec3 _point_light{id}_position;\n    uniform vec3 _point_light{id}_color;\n    uniform float _point_light{id}_range;\n  #pragma endFor\n#endif\n\n#if _NUM_SPOT_LIGHTS > 0\n  #pragma for id in range(0, _NUM_SPOT_LIGHTS)\n    uniform vec3 _spot_light{id}_position;\n    uniform vec3 _spot_light{id}_direction;\n    uniform vec3 _spot_light{id}_color;\n    uniform vec2 _spot_light{id}_spot;\n    uniform float _spot_light{id}_range;\n  #pragma endFor\n#endif\n\n\nLightInfo computeDirectionalLighting(\n  vec3 lightDirection,\n  vec3 lightColor\n) {\n  LightInfo ret;\n  ret.lightDir = -normalize(lightDirection);\n  ret.radiance = lightColor;\n\n  return ret;\n}\n\n\nLightInfo computePointLighting(\n  vec3 lightPosition,\n  vec3 positionW,\n  vec3 lightColor,\n  float lightRange\n) {\n  LightInfo ret;\n  vec3 lightDir = lightPosition - positionW;\n  float attenuation = max(0.0, 1.0 - length(lightDir) / lightRange);\n  ret.lightDir = normalize(lightDir);\n  ret.radiance = lightColor * attenuation;\n\n  return ret;\n}\n\n\nLightInfo computeSpotLighting(\n  vec3 lightPosition,\n  vec3 positionW,\n  vec3 lightDirection,\n  vec3 lightColor,\n  vec2 lightSpot,\n  float lightRange\n) {\n  LightInfo ret;\n  vec3 lightDir = lightPosition - positionW;\n  float attenuation = max(0., 1.0 - length(lightDir) / lightRange);\n  float cosConeAngle = max(0., dot(lightDirection, -lightDir));\n  cosConeAngle = cosConeAngle < lightSpot.x ? 0.0 : cosConeAngle;\n  cosConeAngle = pow(cosConeAngle,lightSpot.y);\n  ret.lightDir = normalize(lightDir);\n  ret.radiance = lightColor * attenuation * cosConeAngle;\n\n  return ret;\n}\n\n#include <unpack>\n\n#if _USE_SHADOW_MAP\n  #include <packing>\n  #include <shadow-mapping>\n#endif\n\nuniform vec3 _eye;\n\nvarying vec3 pos_w;\nvarying vec3 normal_w;\n\n#if USE_ALBEDO_TEXTURE || USE_NORMAL_TEXTURE || USE_MRA_TEXTURE || USE_METALLIC_TEXTURE || USE_ROUGHNESS_TEXTURE || USE_AO_TEXTURE || USE_EMISSIVE_TEXTURE\n  varying vec2 uv0;\n#endif\n\n#if USE_IBL\n  uniform samplerCube diffuseEnvTexture;\n  uniform samplerCube specularEnvTexture;\n  uniform sampler2D brdfLUT;\n  #if USE_TEX_LOD\n    uniform float maxReflectionLod;\n  #endif\n#endif\n\n\nuniform vec4 albedo;\n#if USE_ALBEDO_TEXTURE\n  uniform sampler2D albedo_texture;\n#endif\n\n#if USE_MRA_TEXTURE\n  uniform sampler2D mra_texture;\n#endif\n\nuniform float metallic;\n#if USE_METALLIC_TEXTURE\n  uniform sampler2D metallic_texture;\n#endif\n\nuniform float roughness;\n#if USE_ROUGHNESS_TEXTURE\n  uniform sampler2D roughness_texture;\n#endif\n\nuniform float ao;\n#if USE_AO_TEXTURE\n  uniform sampler2D ao_texture;\n#endif\n\n#if USE_EMISSIVE\n  uniform vec3 emissive;\n  #if USE_EMISSIVE_TEXTURE\n    uniform sampler2D emissive_texture;\n  #endif\n#endif\n\n#if USE_ALPHA_TEST\n  uniform float alphaTestThreshold;\n#endif\n\n#if USE_NORMAL_TEXTURE\n  uniform sampler2D normal_texture;\n  \n  vec3 getNormalFromTexture() {\n    vec3 tangentNormal = texture2D(normal_texture, uv0).rgb * 2.0 - 1.0;\n    vec3 q1  = dFdx(pos_w);\n    vec3 q2  = dFdy(pos_w);\n    vec2 st1 = dFdx(uv0);\n    vec2 st2 = dFdy(uv0);\n    vec3 N   = normalize(normal_w);\n    vec3 T   = normalize(q1*st2.t - q2*st1.t);\n    vec3 B   = -normalize(cross(N, T));\n    mat3 TBN = mat3(T, B, N);\n\n    return normalize(TBN * tangentNormal);\n  }\n#endif\n\n\n\n\nfloat distributionGGX(vec3 N, vec3 H, float roughness) {\n  float a = roughness * roughness;\n  float a2 = a * a;\n  float NdotH = max(dot(N, H), 0.0);\n  float NdotH2 = NdotH * NdotH;\n  float nom   = a2;\n  float denom = (NdotH2 * (a2 - 1.0) + 1.0);\n  denom = PI * denom * denom;\n\n  return nom / denom;\n}\n\n\nfloat geometrySchlickGGX(float NdotV, float roughness) {\n  float r = (roughness + 1.0);\n  float k = (r * r) / 8.0;\n  float nom   = NdotV;\n  float denom = NdotV * (1.0 - k) + k;\n\n  return nom / denom;\n}\nfloat geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {\n  float NdotV = max(dot(N, V), 0.0);\n  float NdotL = max(dot(N, L), 0.0);\n  float ggx2 = geometrySchlickGGX(NdotV, roughness);\n  float ggx1 = geometrySchlickGGX(NdotL, roughness);\n\n  return ggx1 * ggx2;\n}\n\n\n\nvec3 fresnelSchlick(float cosTheta, vec3 F0) {\n  float fresnel = exp2((-5.55473 * cosTheta - 6.98316) * cosTheta);\n  return F0 + (1.0 - F0) * fresnel;\n}\nvec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness) {\n  float fresnel = exp2((-5.55473 * cosTheta - 6.98316) * cosTheta);\n  return F0 + (max(vec3(1.0 - roughness), F0) - F0) * fresnel;\n}\n\n\nvec3 brdf(LightInfo lightInfo, vec3 N, vec3 V, vec3 F0, vec3 albedo, float metallic, float roughness) {\n  vec3 H = normalize(V + lightInfo.lightDir);\n  float NDF = distributionGGX(N, H, roughness);\n  float G   = geometrySmith(N, V, lightInfo.lightDir, roughness);\n  vec3 F    = fresnelSchlick(max(dot(H, V), 0.0), F0);\n  vec3 nominator    = NDF * G * F;\n  float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, lightInfo.lightDir), 0.0) + 0.001; \n  vec3 specular = nominator / denominator;\n  \n  vec3 kS = F;\n  \n  \n  \n  vec3 kD = vec3(1.0) - kS;\n  \n  \n  \n  kD *= 1.0 - metallic;\n  float NdotL = max(dot(N, lightInfo.lightDir), 0.0);\n\n  return (kD * albedo / PI + specular) * lightInfo.radiance * NdotL;\n}\n\nvec4 frag() {\n  float opacity = 1.0;\n\n  #if USE_ALBEDO_TEXTURE\n    vec4 baseColor = albedo * gammaToLinearSpaceRGBA(texture2D(albedo_texture, uv0));\n    vec3 albedo = baseColor.rgb;\n    opacity = baseColor.a;\n  #else\n    opacity = albedo.a;\n    vec3 albedo = albedo.rgb;\n  #endif\n\n  #if USE_ALPHA_TEST\n    if(opacity < alphaTestThreshold) discard;\n  #endif\n\n  #if USE_MRA_TEXTURE\n    vec3 metalRoughness = texture2D(mra_texture, uv0).rgb;\n    float metallic = metalRoughness.r;\n    float roughness = metalRoughness.g;\n    float ao = metalRoughness.b;\n  #else\n    #if USE_METALLIC_TEXTURE\n      float metallic  = texture2D(metallic_texture, uv0).r;\n    #endif\n    #if USE_ROUGHNESS_TEXTURE\n      float roughness  = texture2D(roughness_texture, uv0).r;\n    #endif\n    #if USE_AO_TEXTURE\n      float ao  = texture2D(ao_texture, uv0).r;\n    #endif\n  #endif\n\n  vec3 N = normalize(normal_w);\n  #if USE_NORMAL_TEXTURE\n    N = getNormalFromTexture();\n  #endif\n  vec3 V = normalize(_eye - pos_w);\n\n  \n  \n  vec3 F0 = vec3(0.04);\n  F0 = mix(F0, albedo, metallic);\n\n  \n  vec3 Lo = vec3(0.0);\n\n  \n  #if _NUM_POINT_LIGHTS > 0\n    #pragma for id in range(0, _NUM_POINT_LIGHTS)\n      LightInfo pointLight{id};\n      pointLight{id} = computePointLighting(_point_light{id}_position, pos_w, _point_light{id}_color, _point_light{id}_range);\n      Lo += brdf(pointLight{id}, N, V, F0, albedo, metallic, roughness);\n    #pragma endFor\n  #endif\n\n  #if _NUM_DIR_LIGHTS > 0\n    #pragma for id in range(0, _NUM_DIR_LIGHTS)\n      LightInfo directionalLight{id};\n      directionalLight{id} = computeDirectionalLighting(_dir_light{id}_direction, _dir_light{id}_color);\n      Lo += brdf(directionalLight{id}, N, V, F0, albedo, metallic, roughness);\n    #pragma endFor\n  #endif\n\n  #if _NUM_SPOT_LIGHTS > 0\n    #pragma for id in range(0, _NUM_SPOT_LIGHTS)\n      LightInfo spotLight{id};\n      spotLight{id} = computeSpotLighting(_spot_light{id}_position, pos_w, _spot_light{id}_direction, _spot_light{id}_color, _spot_light{id}_spot, _spot_light{id}_range);\n      Lo += brdf(spotLight{id}, N, V, F0, albedo, metallic, roughness);\n    #pragma endFor\n  #endif\n\n  #if USE_EMISSIVE\n    vec3 emissiveColor = emissive;\n    #if USE_EMISSIVE_TEXTURE\n      emissiveColor *= gammaToLinearSpaceRGB(texture2D(emissive_texture, uv0).rgb);\n    #endif\n    Lo += emissiveColor;\n  #endif\n\n  \n  vec3 ambient = vec3(0.03) * albedo * ao;\n\n  #if USE_IBL\n    \n    vec3 F = fresnelSchlickRoughness(max(dot(N, V), 0.0), F0, roughness);\n    vec3 kS = F;\n    vec3 kD = vec3(1.0) - kS;\n    kD *= 1.0 - metallic;\n    #if USE_RGBE_IBL_DIFFUSE\n      vec3 diffuseEnv = unpackRGBE(textureCube(diffuseEnvTexture, N));\n    #else\n      vec3 diffuseEnv = textureCube(diffuseEnvTexture, N).rgb;\n    #endif\n    vec3 diffuse = diffuseEnv * albedo;\n    \n    vec3 R = reflect(-V, N);\n    #if USE_TEX_LOD\n      #if USE_RGBE_IBL_SPECULAR\n        vec3 specularEnv = unpackRGBE(textureCubeLodEXT(specularEnvTexture, R, roughness * maxReflectionLod));\n      #else\n        vec3 specularEnv = textureCubeLodEXT(specularEnvTexture, R, roughness * maxReflectionLod).rgb;\n      #endif\n    #else\n      #if USE_RGBE_IBL_SPECULAR\n        vec3 specularEnv = unpackRGBE(textureCube(specularEnvTexture, R));\n      #else\n        vec3 specularEnv = textureCube(specularEnvTexture, R).rgb;\n      #endif\n    #endif\n    vec2 brdf  = texture2D(brdfLUT, vec2(max(dot(N, V), 0.0), 1.0 - roughness)).rg;\n    vec3 specular = specularEnv * (F * brdf.x + brdf.y);\n    ambient = (kD * diffuse + specular) * ao;\n  #endif\n\n  #if _USE_SHADOW_MAP\n    float shadow = 1.0;\n    #if _NUM_SHADOW_LIGHTS > 0\n      #pragma for id in range(0, _NUM_SHADOW_LIGHTS)\n        shadow *= computeShadowESM(_shadowMap_{id}, pos_lightspace_{id}, vDepth_{id}, _depthScale_{id}, _darkness_{id}, _frustumEdgeFalloff_{id});\n      #pragma endFor\n    #endif\n    vec3 color = (ambient + Lo) * shadow;\n  #else\n    vec3 color = ambient + Lo;\n  #endif\n\n  \n  color = color / (color + vec3(1.0));\n  \n  vec4 finalColor = vec4(color, opacity);\n\n  return linearToGammaSpaceRGBA(finalColor);\n}\n",
  "pbr-vs": "\n\nattribute vec3 a_position;\nattribute vec3 a_normal;\n\nvarying vec3 pos_w;\nvarying vec3 normal_w;\n\nuniform mat4 _model;\nuniform mat4 _viewProj;\nuniform mat3 _normalMatrix;\n\n#if USE_ALBEDO_TEXTURE || USE_NORMAL_TEXTURE || USE_MRA_TEXTURE || USE_METALLIC_TEXTURE || USE_ROUGHNESS_TEXTURE || USE_AO_TEXTURE || USE_MRA_TEXTURE || USE_EMISSIVE_TEXTURE\n  attribute vec2 a_uv0;\n  uniform vec2 mainTiling;\n  uniform vec2 mainOffset;\n  varying vec2 uv0;\n#endif\n\n#if _USE_SKINNING\n  #include <skinning>\n#endif\n\n#if _USE_SHADOW_MAP\n  #if _NUM_SHADOW_LIGHTS > 0\n    #pragma for id in range(0, _NUM_SHADOW_LIGHTS)\n      uniform mat4 _lightViewProjMatrix_{id};\n      uniform float _minDepth_{id};\n      uniform float _maxDepth_{id};\n      varying vec4 pos_lightspace_{id};\n      varying float vDepth_{id};\n    #pragma endFor\n  #endif\n#endif\n\nvec4 vert () {\n  vec4 pos = vec4(a_position, 1);\n\n  #if _USE_SKINNING\n    mat4 skinMat = skinMatrix();\n    pos = skinMat * pos;\n  #endif\n\n  pos_w = (_model * pos).xyz;\n  pos = _viewProj * _model * pos;\n\n  #if USE_ALBEDO_TEXTURE || USE_NORMAL_TEXTURE || USE_MRA_TEXTURE || USE_METALLIC_TEXTURE || USE_ROUGHNESS_TEXTURE || USE_AO_TEXTURE || USE_MRA_TEXTURE || USE_EMISSIVE_TEXTURE\n    uv0 = a_uv0 * mainTiling + mainOffset;\n  #endif\n\n  vec4 normal = vec4(a_normal, 0);\n  #if _USE_SKINNING\n    normal = skinMat * normal;\n  #endif\n  normal_w = _normalMatrix * normal.xyz;\n\n  #if _USE_SHADOW_MAP\n    #if _NUM_SHADOW_LIGHTS > 0\n      #pragma for id in range(0, _NUM_SHADOW_LIGHTS)\n        pos_lightspace_{id} = _lightViewProjMatrix_{id} * vec4(pos_w, 1.0);\n        vDepth_{id} = (pos_lightspace_{id}.z + _minDepth_{id}) / (_minDepth_{id} + _maxDepth_{id});\n      #pragma endFor\n    #endif\n  #endif\n\n  return pos;\n}\n",
  "phong-fs": "\n\n#if USE_NORMAL_TEXTURE\n#extension GL_OES_standard_derivatives : enable\n#endif\n\n#include <common>\n#include <gamma-correction>\n\nstruct LightInfo {\n  vec3 diffuse;\n  vec3 specular;\n};\n\nLightInfo computeDirectionalLighting(\n  vec3 lightDirection,\n  vec3 lightColor,\n  vec3 normal,\n  vec3 viewDirection,\n  float glossiness\n) {\n  LightInfo lightingResult;\n  float ndl = 0.0;\n  float ndh = 0.0;\n  vec3 lightDir = -normalize(lightDirection);\n  ndl = max(0.0, dot(normal, lightDir));\n  lightingResult.diffuse = lightColor * ndl;\n\n  vec3 dirH = normalize(viewDirection + lightDir);\n  ndh = max(0.0, dot(normal, dirH));\n  ndh = (ndl == 0.0) ? 0.0: ndh;\n  ndh = pow(ndh, max(1.0, glossiness * 128.0));\n  lightingResult.specular = lightColor * ndh;\n\n  return lightingResult;\n}\n\nLightInfo computePointLighting(\n  vec3 lightPosition,\n  vec3 lightColor,\n  float lightRange,\n  vec3 normal,\n  vec3 positionW,\n  vec3 viewDirection,\n  float glossiness\n) {\n  LightInfo lightingResult;\n  float ndl = 0.0;\n  float ndh = 0.0;\n  vec3 lightDir = vec3(0, 0, 0);\n  float attenuation = 1.0;\n  lightDir = lightPosition - positionW;\n  attenuation = max(0., 1.0 - length(lightDir) / lightRange);\n  lightDir = normalize(lightDir);\n  ndl = max(0.0, dot(normal, lightDir));\n  lightingResult.diffuse = lightColor * ndl * attenuation;\n\n  vec3 dirH = normalize(viewDirection + lightDir);\n  ndh = max(0.0, dot(normal, dirH));\n  ndh = (ndl == 0.0) ? 0.0: ndh;\n  ndh = pow(ndh, max(1.0, glossiness * 128.0));\n  lightingResult.specular = lightColor * ndh * attenuation;\n\n  return lightingResult;\n}\n\nLightInfo computeSpotLighting(\n  vec3 lightPosition,\n  vec3 lightDirection,\n  vec3 lightColor,\n  float lightRange,\n  vec2 lightSpot,\n  vec3 normal,\n  vec3 positionW,\n  vec3 viewDirection,\n  float glossiness\n) {\n  LightInfo lightingResult;\n  float ndl = 0.0;\n  float ndh = 0.0;\n  vec3 lightDir = vec3(0, 0, 0);\n  float attenuation = 1.0;\n  float cosConeAngle = 1.0;\n\n  lightDir = lightPosition - positionW;\n  attenuation = max(0., 1.0 - length(lightDir) / lightRange);\n  lightDir = normalize(lightDir);\n  cosConeAngle = max(0., dot(lightDirection, -lightDir));\n  cosConeAngle = cosConeAngle < lightSpot.x ? 0.0 : cosConeAngle;\n  cosConeAngle = pow(cosConeAngle,lightSpot.y);\n  ndl = max(0.0, dot(normal, lightDir));\n  lightingResult.diffuse = lightColor * ndl * attenuation * cosConeAngle;\n\n  vec3 dirH = normalize(viewDirection + lightDir);\n  ndh = max(0.0, dot(normal, dirH));\n  ndh = (ndl == 0.0) ? 0.0: ndh;\n  ndh = pow(ndh, max(1.0, glossiness * 128.0));\n  lightingResult.specular = lightColor * ndh * attenuation * cosConeAngle;\n\n  return lightingResult;\n}\n\n#if _NUM_DIR_LIGHTS > 0\n  #pragma for id in range(0, _NUM_DIR_LIGHTS)\n    uniform vec3 _dir_light{id}_direction;\n    uniform vec3 _dir_light{id}_color;\n  #pragma endFor\n#endif\n\n#if _NUM_POINT_LIGHTS > 0\n  #pragma for id in range(0, _NUM_POINT_LIGHTS)\n    uniform vec3 _point_light{id}_position;\n    uniform vec3 _point_light{id}_color;\n    uniform float _point_light{id}_range;\n  #pragma endFor\n#endif\n\n#if _NUM_SPOT_LIGHTS > 0\n  #pragma for id in range(0, _NUM_SPOT_LIGHTS)\n    uniform vec3 _spot_light{id}_position;\n    uniform vec3 _spot_light{id}_direction;\n    uniform vec3 _spot_light{id}_color;\n    uniform float _spot_light{id}_range;\n    uniform vec2 _spot_light{id}_spot;\n  #pragma endFor\n#endif\n\nLightInfo getPhongLighting(\n  vec3 normal,\n  vec3 positionW,\n  vec3 viewDirection,\n  float glossiness\n) {\n  LightInfo result;\n  result.diffuse = vec3(0, 0, 0);\n  result.specular = vec3(0, 0, 0);\n  LightInfo dirLighting;\n  #if _NUM_DIR_LIGHTS > 0\n    #pragma for id in range(0, _NUM_DIR_LIGHTS)\n      dirLighting = computeDirectionalLighting(_dir_light{id}_direction,_dir_light{id}_color,normal, viewDirection, glossiness);\n      result.diffuse += dirLighting.diffuse;\n      result.specular += dirLighting.specular;\n    #pragma endFor\n  #endif\n\n  LightInfo pointLighting;\n  #if _NUM_POINT_LIGHTS > 0\n    #pragma for id in range(0, _NUM_POINT_LIGHTS)\n      pointLighting = computePointLighting(_point_light{id}_position, _point_light{id}_color, _point_light{id}_range,\n                                          normal, positionW, viewDirection, glossiness);\n      result.diffuse += pointLighting.diffuse;\n      result.specular += pointLighting.specular;\n    #pragma endFor\n  #endif\n\n  LightInfo spotLighting;\n  #if _NUM_SPOT_LIGHTS > 0\n    #pragma for id in range(0, _NUM_SPOT_LIGHTS)\n      spotLighting = computeSpotLighting(_spot_light{id}_position, _spot_light{id}_direction, _spot_light{id}_color,\n                      _spot_light{id}_range, _spot_light{id}_spot,normal, positionW, viewDirection, glossiness);\n      result.diffuse += spotLighting.diffuse;\n      result.specular += spotLighting.specular;\n    #pragma endFor\n  #endif\n  return result;\n}\n\n#if _USE_SHADOW_MAP\n  #include <packing>\n  #include <shadow-mapping>\n#endif\n\nuniform vec3 _eye;\nuniform vec3 ambient;\n\nvarying vec3 normal_w;\nvarying vec3 pos_w;\n\n#if USE_NORMAL_TEXTURE || USE_DIFFUSE_TEXTURE || USE_EMISSIVE_TEXTURE\n  varying vec2 uv0;\n#endif\n\nstruct phongMaterial\n{\n  vec3 diffuse;\n  vec3 emissive;\n  vec3 specular;\n  float glossiness;\n  float opacity;\n};\n\nuniform vec4 diffuseColor;\n#if USE_DIFFUSE_TEXTURE\n  uniform sampler2D diffuse_texture;\n#endif\n\n#if USE_EMISSIVE\n  uniform vec3 emissiveColor;\n  #if USE_EMISSIVE_TEXTURE\n    uniform sampler2D emissive_texture;\n  #endif\n#endif\n\n#if USE_SPECULAR\n  uniform vec3 specularColor;\n  uniform float glossiness;\n  #if USE_SPECULAR_TEXTURE\n    uniform sampler2D specular_texture;\n  #endif\n#endif\n\n#if USE_NORMAL_TEXTURE\n  uniform sampler2D normal_texture;\n  uniform float normalScale;  \n  vec3 getNormal(vec3 pos, vec3 normal) {\n    vec3 q0 = vec3( dFdx( pos.x ), dFdx( pos.y ), dFdx( pos.z ) );\n    vec3 q1 = vec3( dFdy( pos.x ), dFdy( pos.y ), dFdy( pos.z ) );\n    vec2 st0 = dFdx( uv0.st );\n    vec2 st1 = dFdy( uv0.st );\n    vec3 S = normalize( q0 * st1.t - q1 * st0.t );\n    vec3 T = normalize( -q0 * st1.s + q1 * st0.s );\n    vec3 N = normal;\n    vec3 mapN = texture2D(normal_texture, uv0).rgb * 2.0 - 1.0;\n    mapN.xy = 1.0 * mapN.xy;\n    mat3 tsn = mat3( S, T, N );\n    return normalize( tsn * mapN );\n  }\n#endif\n\n#if USE_ALPHA_TEST\n  uniform float alphaTestThreshold;\n#endif\n\nphongMaterial getPhongMaterial() {\n  phongMaterial result;\n\n  #if USE_DIFFUSE_TEXTURE\n    vec4 baseColor = diffuseColor * gammaToLinearSpaceRGBA(texture2D(diffuse_texture, uv0));\n    result.diffuse = baseColor.rgb;\n    result.opacity = baseColor.a;\n  #else\n    result.diffuse = diffuseColor.rgb;\n    result.opacity = diffuseColor.a;\n  #endif\n\n  #if USE_EMISSIVE\n    result.emissive = gammaToLinearSpaceRGB(emissiveColor);\n    #if USE_EMISSIVE_TEXTURE\n      result.emissive *= gammaToLinearSpaceRGB(texture2D(emissive_texture, uv0).rgb);\n    #endif\n  #endif\n\n  #if USE_SPECULAR\n    result.specular = gammaToLinearSpaceRGB(specularColor);\n    #if USE_SPECULAR_TEXTURE\n      result.specular = gammaToLinearSpaceRGB(texture2D(specular_texture, uv0).rgb);\n    #endif\n\n    result.glossiness = glossiness;\n  #endif\n\n  return result;\n}\n\nvec4 composePhongShading(LightInfo lighting, phongMaterial mtl, float shadow)\n{\n  vec4 o = vec4(0.0, 0.0, 0.0, 1.0);\n\n  \n  o.xyz = lighting.diffuse * mtl.diffuse;\n  #if USE_EMISSIVE\n    o.xyz += mtl.emissive;\n  #endif\n  #if USE_SPECULAR\n    o.xyz += lighting.specular * mtl.specular;\n  #endif\n  o.xyz *= shadow;\n  o.w = mtl.opacity;\n\n  return o;\n}\n\nvec4 frag () {\n  LightInfo phongLighting;\n  vec3 viewDirection = normalize(_eye - pos_w);\n\n  phongMaterial mtl = getPhongMaterial();\n  #if USE_ALPHA_TEST\n    if(mtl.opacity < alphaTestThreshold) discard;\n  #endif\n  vec3 normal = normalize(normal_w);\n  #if USE_NORMAL_TEXTURE\n    normal = getNormal(pos_w, normal);\n  #endif\n  phongLighting = getPhongLighting(normal, pos_w, viewDirection, mtl.glossiness);\n  phongLighting.diffuse += ambient;\n\n  #if _USE_SHADOW_MAP\n    float shadow = 1.0;\n    #if _NUM_SHADOW_LIGHTS > 0\n      #pragma for id in range(0, _NUM_SHADOW_LIGHTS)\n        shadow *= computeShadowESM(_shadowMap_{id}, pos_lightspace_{id}, vDepth_{id}, _depthScale_{id}, _darkness_{id}, _frustumEdgeFalloff_{id});\n      #pragma endFor\n    #endif\n    vec4 finalColor = composePhongShading(phongLighting, mtl, shadow);\n  #else\n    vec4 finalColor = composePhongShading(phongLighting, mtl, 1.0);\n  #endif\n\n  return linearToGammaSpaceRGBA(finalColor);\n}\n",
  "phong-vs": "\n\nattribute vec3 a_position;\nattribute vec3 a_normal;\n\nuniform mat4 _model;\nuniform mat4 _viewProj;\nuniform mat3 _normalMatrix;\n\nvarying vec3 normal_w;\nvarying vec3 pos_w;\n\n#if USE_NORMAL_TEXTURE || USE_DIFFUSE_TEXTURE || USE_EMISSIVE_TEXTURE\n  attribute vec2 a_uv0;\n  uniform vec2 mainTiling;\n  uniform vec2 mainOffset;\n  varying vec2 uv0;\n#endif\n\n#if _USE_SKINNING\n  #include <skinning>\n#endif\n\n#if _USE_SHADOW_MAP\n  #if _NUM_SHADOW_LIGHTS > 0\n    #pragma for id in range(0, _NUM_SHADOW_LIGHTS)\n      uniform mat4 _lightViewProjMatrix_{id};\n      uniform float _minDepth_{id};\n      uniform float _maxDepth_{id};\n      varying vec4 pos_lightspace_{id};\n      varying float vDepth_{id};\n    #pragma endFor\n  #endif\n#endif\n\nvec4 vert () {\n  vec4 pos = vec4(a_position, 1);\n\n  #if _USE_SKINNING\n    mat4 skinMat = skinMatrix();\n    pos = skinMat * pos;\n  #endif\n\n  pos_w = (_model * pos).xyz;\n  pos = _viewProj * _model * pos;\n\n  #if USE_NORMAL_TEXTURE || USE_DIFFUSE_TEXTURE || USE_EMISSIVE_TEXTURE\n    uv0 = a_uv0 * mainTiling + mainOffset;\n  #endif\n\n  vec4 normal = vec4(a_normal, 0);\n  #if _USE_SKINNING\n    normal = skinMat * normal;\n  #endif\n  normal_w = _normalMatrix * normal.xyz;\n\n  #if _USE_SHADOW_MAP\n    #if _NUM_SHADOW_LIGHTS > 0\n      #pragma for id in range(0, _NUM_SHADOW_LIGHTS)\n        pos_lightspace_{id} = _lightViewProjMatrix_{id} * vec4(pos_w, 1.0);\n        vDepth_{id} = (pos_lightspace_{id}.z + _minDepth_{id}) / (_minDepth_{id} + _maxDepth_{id});\n      #pragma endFor\n    #endif\n  #endif\n\n  return pos;\n}\n",
  "rect-area-light": "\n\nmat3 transpose(mat3 v) {\n    mat3 tmp;\n    tmp[0] = vec3(v[0].x, v[1].x, v[2].x);\n    tmp[1] = vec3(v[0].y, v[1].y, v[2].y);\n    tmp[2] = vec3(v[0].z, v[1].z, v[2].z);\n\n    return tmp;\n}\n\nvoid ClipQuadToHorizon(inout vec3 L[5], out int n) {\n    \n    int config = 0;\n    if (L[0].z > 0.0) config += 1;\n    if (L[1].z > 0.0) config += 2;\n    if (L[2].z > 0.0) config += 4;\n    if (L[3].z > 0.0) config += 8;\n    config = 15;\n\n    \n    n = 0;\n\n    if (config == 0)\n    {\n        \n    }\n    else if (config == 1) \n    {\n        n = 3;\n        L[1] = -L[1].z * L[0] + L[0].z * L[1];\n        L[2] = -L[3].z * L[0] + L[0].z * L[3];\n    }\n    else if (config == 2) \n    {\n        n = 3;\n        L[0] = -L[0].z * L[1] + L[1].z * L[0];\n        L[2] = -L[2].z * L[1] + L[1].z * L[2];\n    }\n    else if (config == 3) \n    {\n        n = 4;\n        L[2] = -L[2].z * L[1] + L[1].z * L[2];\n        L[3] = -L[3].z * L[0] + L[0].z * L[3];\n    }\n    else if (config == 4) \n    {\n        n = 3;\n        L[0] = -L[3].z * L[2] + L[2].z * L[3];\n        L[1] = -L[1].z * L[2] + L[2].z * L[1];\n    }\n    else if (config == 5) \n    {\n        n = 0;\n    }\n    else if (config == 6) \n    {\n        n = 4;\n        L[0] = -L[0].z * L[1] + L[1].z * L[0];\n        L[3] = -L[3].z * L[2] + L[2].z * L[3];\n    }\n    else if (config == 7) \n    {\n        n = 5;\n        L[4] = -L[3].z * L[0] + L[0].z * L[3];\n        L[3] = -L[3].z * L[2] + L[2].z * L[3];\n    }\n    else if (config == 8) \n    {\n        n = 3;\n        L[0] = -L[0].z * L[3] + L[3].z * L[0];\n        L[1] = -L[2].z * L[3] + L[3].z * L[2];\n        L[2] =  L[3];\n    }\n    else if (config == 9) \n    {\n        n = 4;\n        L[1] = -L[1].z * L[0] + L[0].z * L[1];\n        L[2] = -L[2].z * L[3] + L[3].z * L[2];\n    }\n    else if (config == 10) \n    {\n        n = 0;\n    }\n    else if (config == 11) \n    {\n        n = 5;\n        L[4] = L[3];\n        L[3] = -L[2].z * L[3] + L[3].z * L[2];\n        L[2] = -L[2].z * L[1] + L[1].z * L[2];\n    }\n    else if (config == 12) \n    {\n        n = 4;\n        L[1] = -L[1].z * L[2] + L[2].z * L[1];\n        L[0] = -L[0].z * L[3] + L[3].z * L[0];\n    }\n    else if (config == 13) \n    {\n        n = 5;\n        L[4] = L[3];\n        L[3] = L[2];\n        L[2] = -L[1].z * L[2] + L[2].z * L[1];\n        L[1] = -L[1].z * L[0] + L[0].z * L[1];\n    }\n    else if (config == 14) \n    {\n        n = 5;\n        L[4] = -L[0].z * L[3] + L[3].z * L[0];\n        L[0] = -L[0].z * L[1] + L[1].z * L[0];\n    }\n    else if (config == 15) \n    {\n        n = 4;\n    }\n\n    if (n == 3)\n        L[3] = L[0];\n    if (n == 4)\n        L[4] = L[0];\n}\n\n\nfloat IntegrateEdge(vec3 v1, vec3 v2) {\n    float cosTheta = dot(v1, v2);\n    float theta = acos(cosTheta);\n    return cross(v1, v2).z * ((theta > 0.001) ? theta/sin(theta) : 4.0);\n}\n\nvec3 LTC_Evaluate(vec3 N, vec3 V, vec3 P, mat3 Minv, vec3 points[4]) {\n    \n    vec3 T1, T2;\n    T1 = normalize(V - N*dot(V, N));\n    T2 = cross(N, T1);\n\n    \n    Minv = Minv * transpose(mat3(T1, T2, N));\n\n    \n    vec3 L[5];\n    L[0] = Minv * (points[0] - P);\n    L[1] = Minv * (points[1] - P);\n    L[2] = Minv * (points[2] - P);\n    L[3] = Minv * (points[3] - P);\n\n    int n;\n    ClipQuadToHorizon(L, n);\n\n    if (n == 0)\n        return vec3(0, 0, 0);\n\n    \n    L[0] = normalize(L[0]);\n    L[1] = normalize(L[1]);\n    L[2] = normalize(L[2]);\n    L[3] = normalize(L[3]);\n    L[4] = normalize(L[4]);\n\n    \n    float sum = 0.0;\n\n    sum += IntegrateEdge(L[0], L[1]);\n    sum += IntegrateEdge(L[1], L[2]);\n    sum += IntegrateEdge(L[2], L[3]);\n    if (n >= 4)\n        sum += IntegrateEdge(L[3], L[4]);\n    if (n == 5)\n        sum += IntegrateEdge(L[4], L[0]);\n\n    sum = max(0.0, sum);\n\n    vec3 Lo_i = vec3(sum, sum, sum);\n\n    return Lo_i;\n}\n",
  "shadow-depth-fs": "\n\nuniform float _depthScale;\nvarying float vDepth;\n\n#include <packing>\n\nvec4 frag() {\n  \n  \n  return packDepthToRGBA(vDepth);\n  \n  \n}\n",
  "shadow-depth-vs": "\n\nattribute vec3 a_position;\n\nuniform mat4 _model;\nuniform mat4 _lightViewProjMatrix;\nuniform float _minDepth;\nuniform float _maxDepth;\nuniform float _bias;\nvarying float vDepth;\n\n#if _USE_SKINNING\n  #include <skinning>\n#endif\n\nvec4 vert() {\n  vec4 pos = vec4(a_position, 1);\n\n  #if _USE_SKINNING\n    mat4 skinMat = skinMatrix();\n    pos = skinMat * pos;\n  #endif\n\n  \n  vDepth = ((gl_Position.z + _minDepth) / (_minDepth + _maxDepth)) + _bias;\n  return _lightViewProjMatrix * _model * pos;\n}\n",
  "shadow-mapping": "\n\n#if _NUM_SHADOW_LIGHTS > 0\n  #pragma for id in range(0, _NUM_SHADOW_LIGHTS)\n    uniform sampler2D _shadowMap_{id};\n    uniform float _darkness_{id};\n    uniform float _depthScale_{id};\n    uniform float _frustumEdgeFalloff_{id};\n    uniform float _bias_{id};\n    uniform vec2 _texelSize_{id};\n    varying vec4 pos_lightspace_{id};\n    varying float vDepth_{id};\n  #pragma endFor\n#endif\n\nfloat computeShadow(sampler2D shadowMap, vec4 pos_lightspace, float bias) {\n  vec3 projCoords = pos_lightspace.xyz / pos_lightspace.w;\n  projCoords = projCoords * 0.5 + 0.5;\n  float closestDepth = unpackRGBAToDepth(texture2D(shadowMap, projCoords.xy));\n  float currentDepth = projCoords.z;\n  float shadow = (currentDepth - bias > closestDepth) ? 0.0 : 1.0;\n  return shadow;\n}\n\nfloat computeFallOff(float esm, vec2 coords, float frustumEdgeFalloff) {\n  float mask = smoothstep(1.0 - frustumEdgeFalloff, 1.0, clamp(dot(coords, coords), 0.0, 1.0));\n  return mix(esm, 1.0, mask);\n}\n\n\n\n\n\n\n\n\n\n\n\n\n\n\nfloat computeShadowESM(sampler2D shadowMap, vec4 pos_lightspace, float vDepth, float depthScale, float darkness, float frustumEdgeFalloff) {\n  vec2 projCoords = pos_lightspace.xy / pos_lightspace.w;\n  vec2 shadowUV = projCoords * 0.5 + vec2(0.5);\n  if (shadowUV.x < 0.0 || shadowUV.x > 1.0 || shadowUV.y < 0.0 || shadowUV.y > 1.0) {\n    return 1.0;\n  }\n  float currentDepth = clamp(vDepth, 0.0, 1.0);\n  float closestDepth = unpackRGBAToDepth(texture2D(shadowMap, shadowUV));\n  \n  float esm = clamp(exp(-depthScale * (currentDepth - closestDepth)), 1.0 - darkness, 1.0);\n  return computeFallOff(esm, projCoords, frustumEdgeFalloff);\n}\n\nfloat computeShadowPCF(sampler2D shadowMap, vec4 pos_lightspace, float vDepth, float darkness, vec2 texelSize, float frustumEdgeFalloff) {\n  vec2 projCoords = pos_lightspace.xy / pos_lightspace.w;\n  vec2 shadowUV = projCoords * 0.5 + vec2(0.5);\n  if (shadowUV.x < 0.0 || shadowUV.x > 1.0 || shadowUV.y < 0.0 || shadowUV.y > 1.0) {\n    return 1.0;\n  }\n  float currentDepth = clamp(vDepth, 0.0, 1.0);\n  float visibility = 1.0;\n  vec2 poissonDisk[4];\n  poissonDisk[0] = vec2(-0.94201624, -0.39906216);\n  poissonDisk[1] = vec2(0.94558609, -0.76890725);\n  poissonDisk[2] = vec2(-0.094184101, -0.92938870);\n  poissonDisk[3] = vec2(0.34495938, 0.29387760);\n  if (unpackRGBAToDepth(texture2D(shadowMap, shadowUV + poissonDisk[0] * texelSize)) < currentDepth) visibility -= 0.25;\n  if (unpackRGBAToDepth(texture2D(shadowMap, shadowUV + poissonDisk[1] * texelSize)) < currentDepth) visibility -= 0.25;\n  if (unpackRGBAToDepth(texture2D(shadowMap, shadowUV + poissonDisk[2] * texelSize)) < currentDepth) visibility -= 0.25;\n  if (unpackRGBAToDepth(texture2D(shadowMap, shadowUV + poissonDisk[3] * texelSize)) < currentDepth) visibility -= 0.25;\n\n  return computeFallOff(min(1.0, visibility + 1.0 - darkness), projCoords, frustumEdgeFalloff);\n}",
  "skinning": "\n\nattribute vec4 a_weights;\nattribute vec4 a_joints;\n\n#if _USE_JOINTS_TEXTRUE\nuniform sampler2D _jointsTexture;\nuniform float _jointsTextureSize;\n\nmat4 getBoneMatrix(const in float i) {\n  float size = _jointsTextureSize;\n  float j = i * 4.0;\n  float x = mod(j, size);\n  float y = floor(j / size);\n\n  float dx = 1.0 / size;\n  float dy = 1.0 / size;\n\n  y = dy * (y + 0.5);\n\n  vec4 v1 = texture2D(_jointsTexture, vec2(dx * (x + 0.5), y));\n  vec4 v2 = texture2D(_jointsTexture, vec2(dx * (x + 1.5), y));\n  vec4 v3 = texture2D(_jointsTexture, vec2(dx * (x + 2.5), y));\n  vec4 v4 = texture2D(_jointsTexture, vec2(dx * (x + 3.5), y));\n\n  return mat4(v1, v2, v3, v4);\n}\n#else\nuniform mat4 _jointMatrices[64];\n\nmat4 getBoneMatrix(const in float i) {\n  return _jointMatrices[int(i)];\n}\n#endif\n\nmat4 skinMatrix() {\n  return\n    getBoneMatrix(a_joints.x) * a_weights.x +\n    getBoneMatrix(a_joints.y) * a_weights.y +\n    getBoneMatrix(a_joints.z) * a_weights.z +\n    getBoneMatrix(a_joints.w) * a_weights.w\n    ;\n}",
  "unlit-fs": "\n\n#if USE_TEXTURE\n  uniform sampler2D texture;\n#endif\n\n#if _USE_ATTRIBUTE_UV0\n  varying vec2 v_uv0;\n#endif\n\n#if _USE_ATTRIBUTE_COLOR\n  varying vec4 v_color;\n#endif\n\nuniform vec4 color;\n\nvec4 frag () {\n  vec4 o = color;\n  \n  #if _USE_ATTRIBUTE_COLOR\n    o *= v_color;\n  #endif\n\n  #if USE_TEXTURE && _USE_ATTRIBUTE_UV0\n    o *= texture2D(texture, v_uv0);\n  #endif\n\n  return o;\n}",
  "unlit-vs": "\n\nuniform mat4 _viewProj;\nuniform mat4 _model;\n\nattribute vec3 a_position;\n\n#if _USE_ATTRIBUTE_COLOR\n  attribute lowp vec4 a_color;\n  varying lowp vec4 v_color;\n#endif\n\n#if _USE_ATTRIBUTE_UV0\n  attribute vec2 a_uv0;\n  varying vec2 v_uv0;\n#endif\n\n#if _USE_SKINNING\n  #include <skinning>\n#endif\n\nvec4 vert () {\n  mat4 mvp = _viewProj * _model;\n\n  #if _USE_SKINNING\n    mvp = mvp * skinMatrix();\n  #endif\n\n  vec4 pos = mvp * vec4(a_position, 1);\n\n  #if _USE_ATTRIBUTE_UV0\n    v_uv0 = a_uv0;\n  #endif\n\n  #if _USE_ATTRIBUTE_COLOR\n    v_color = a_color;\n  #endif\n\n  return pos;\n}",
  "unpack": "\n\nvec3 unpackNormal(vec4 nmap) {\n  return nmap.xyz * 2.0 - 1.0;\n}\n\nvec3 unpackRGBE(vec4 rgbe) {\n    return rgbe.rgb * pow(2.0, rgbe.a * 255.0 - 128.0);\n}"
}