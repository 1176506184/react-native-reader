/*
 * Adapted from ogulcanbagatir/rn-animated-components PageCurl (MIT).
 * Copyright (c) 2025 ogulcanbagatir.
 *
 * The underlying page curl shader is licensed under BSD-3-Clause:
 * Copyright (c) 2010 Hewlett-Packard Development Company, L.P.
 */

export const PAGE_CURL_SHADER = `
  uniform shader fromImg;
  uniform shader toImg;
  uniform float2 resolution;
  uniform float progress;
  uniform float4 backsideColor;

  const float MIN_AMOUNT = -0.26;
  const float MAX_AMOUNT = 1.15;
  const float PI = 3.141592653589793;
  const float scale = 512.0;
  const float sharpness = 3.0;

  float2 mapUV(float2 uv) {
    return uv;
  }

  float2 geomUV(float2 uv) {
    return uv;
  }

  float4 getFromColor(float2 p) {
    return fromImg.eval(mapUV(p) * resolution);
  }

  float4 getToColor(float2 p) {
    return toImg.eval(mapUV(p) * resolution);
  }

  float3 hitPoint(float hitAngle, float yc, float3 point, float3x3 reverseRotation) {
    point.y = hitAngle / (2.0 * PI);
    return float3(reverseRotation * point);
  }

  float4 antiAlias(float4 color1, float4 color2, float distanceValue) {
    distanceValue *= scale;
    if (distanceValue < 0.0) return color2;
    if (distanceValue > 2.0) return color1;
    float amount = pow(1.0 - distanceValue / 2.0, sharpness);
    return ((color2 - color1) * amount) + color1;
  }

  float distanceToEdge(float3 point) {
    float dx = abs(point.x > 0.5 ? 1.0 - point.x : point.x);
    float dy = abs(point.y > 0.5 ? 1.0 - point.y : point.y);
    if (point.x < 0.0) dx = -point.x;
    if (point.x > 1.0) dx = point.x - 1.0;
    if (point.y < 0.0) dy = -point.y;
    if (point.y > 1.0) dy = point.y - 1.0;
    if ((point.x < 0.0 || point.x > 1.0) && (point.y < 0.0 || point.y > 1.0)) {
      return sqrt(dx * dx + dy * dy);
    }
    return min(dx, dy);
  }

  float4 seeThrough(
    float yc,
    float2 p,
    float3x3 rotation,
    float3x3 reverseRotation,
    float cylinderAngle,
    float cylinderRadius
  ) {
    float hitAngle = PI - (acos(yc / cylinderRadius) - cylinderAngle);
    float3 point = hitPoint(hitAngle, yc, rotation * float3(p, 1.0), reverseRotation);
    if (yc <= 0.0 && (point.x < 0.0 || point.y < 0.0 || point.x > 1.0 || point.y > 1.0)) {
      return getToColor(p);
    }
    if (yc > 0.0) return getFromColor(p);
    float4 color = getFromColor(point.xy);
    return antiAlias(color, float4(0.0), distanceToEdge(point));
  }

  float4 seeThroughWithShadow(
    float yc,
    float2 p,
    float3 point,
    float3x3 rotation,
    float3x3 reverseRotation,
    float cylinderAngle,
    float cylinderRadius,
    float amount
  ) {
    float shadow = (1.0 - distanceToEdge(point) * 30.0) / 3.0;
    if (shadow < 0.0) {
      shadow = 0.0;
    } else {
      shadow *= amount;
    }
    float4 color = seeThrough(yc, p, rotation, reverseRotation, cylinderAngle, cylinderRadius);
    color.rgb -= shadow;
    return color;
  }

  float4 backside(float yc, float3 point) {
    float3 sourceColor = getFromColor(point.xy).rgb;
    float curveLight = 0.92 + 0.08 * pow(
      1.0 - abs(yc / (1.0 / PI / 2.0)),
      0.2
    );
    float3 paperColor = mix(backsideColor.rgb, sourceColor, 0.12);
    return float4(paperColor * curveLight, 1.0);
  }

  float4 behindSurface(
    float2 p,
    float yc,
    float3 point,
    float3x3 reverseRotation,
    float cylinderAngle,
    float cylinderRadius,
    float amount
  ) {
    float shadow = (1.0 - ((-cylinderRadius - yc) / amount * 7.0)) / 6.0;
    shadow *= 1.0 - abs(point.x - 0.5);
    yc = -cylinderRadius - cylinderRadius - yc;
    float hitAngle = (acos(yc / cylinderRadius) + cylinderAngle) - PI;
    point = hitPoint(hitAngle, yc, point, reverseRotation);
    if (
      yc < 0.0 &&
      point.x >= 0.0 && point.y >= 0.0 &&
      point.x <= 1.0 && point.y <= 1.0 &&
      (hitAngle < PI || amount > 0.5)
    ) {
      shadow = 1.0 - (sqrt(
        (point.x - 0.5) * (point.x - 0.5) +
        (point.y - 0.5) * (point.y - 0.5)
      ) / 0.71);
      shadow *= pow(-yc / cylinderRadius, 3.0) * 0.5;
    } else {
      shadow = 0.0;
    }
    return float4(getToColor(p).rgb - shadow, 1.0);
  }

  float4 main(float2 xy) {
    float2 uv = xy / resolution;
    float2 p = geomUV(uv);
    float amount = progress * (MAX_AMOUNT - MIN_AMOUNT) + MIN_AMOUNT;
    float cylinderCenter = amount;
    float cylinderAngle = 2.0 * PI * amount;
    float cylinderRadius = 1.0 / PI / 2.0;

    float angle = 100.0 * PI / 180.0;
    float cosine = cos(-angle);
    float sine = sin(-angle);
    float3x3 rotation = float3x3(
      cosine, sine, 0.0,
      -sine, cosine, 0.0,
      -0.801, 0.8900, 1.0
    );
    cosine = cos(angle);
    sine = sin(angle);
    float3x3 reverseRotation = float3x3(
      cosine, sine, 0.0,
      -sine, cosine, 0.0,
      0.98500, 0.985, 1.0
    );

    float3 point = rotation * float3(p, 1.0);
    float yc = point.y - cylinderCenter;

    if (yc < -cylinderRadius) {
      return behindSurface(p, yc, point, reverseRotation, cylinderAngle, cylinderRadius, amount);
    }
    if (yc > cylinderRadius) return getFromColor(p);

    float hitAngle = (acos(yc / cylinderRadius) + cylinderAngle) - PI;
    float hitAngleMod = mod(hitAngle, 2.0 * PI);
    if ((hitAngleMod > PI && amount < 0.5) || (hitAngleMod > PI / 2.0 && amount < 0.0)) {
      return seeThrough(yc, p, rotation, reverseRotation, cylinderAngle, cylinderRadius);
    }

    point = hitPoint(hitAngle, yc, point, reverseRotation);
    if (point.x < 0.0 || point.y < 0.0 || point.x > 1.0 || point.y > 1.0) {
      return seeThroughWithShadow(
        yc,
        p,
        point,
        rotation,
        reverseRotation,
        cylinderAngle,
        cylinderRadius,
        amount
      );
    }

    float4 color = backside(yc, point);
    float4 otherColor = yc < 0.0
      ? float4(
          0.0,
          0.0,
          0.0,
          (1.0 - (sqrt(
            (point.x - 0.5) * (point.x - 0.5) +
            (point.y - 0.5) * (point.y - 0.5)
          ) / 0.71)) * pow(-yc / cylinderRadius, 3.0) * 0.5
        )
      : getFromColor(p);

    color = antiAlias(color, otherColor, cylinderRadius - abs(yc));
    float4 seeThroughColor = seeThroughWithShadow(
      yc,
      p,
      point,
      rotation,
      reverseRotation,
      cylinderAngle,
      cylinderRadius,
      amount
    );
    return antiAlias(color, seeThroughColor, distanceToEdge(point));
  }
`;
