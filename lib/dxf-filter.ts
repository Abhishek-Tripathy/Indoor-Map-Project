import {
  DXFEntity,
  GeoJSONFeature,
  GeoJSONFeatureCollection,
} from "@/types/dxf";

/**
 * Convert ALL DXF entities to GeoJSON without filtering
 */
export function convertToGeoJSON(
  entities: DXFEntity[]
): GeoJSONFeatureCollection {
  const features: GeoJSONFeature[] = [];

  entities.forEach((entity, index) => {
    try {
      const feature = convertEntityToFeature(entity, index);
      if (feature) {
        features.push(feature);
      }
    } catch (error) {
      console.warn(`Failed to convert entity ${index}:`, error);
    }
  });

  console.log(`Converted ${features.length} features from ${entities.length} entities`);

  return {
    type: "FeatureCollection",
    features: features,
  };
}

/**
 * Convert single DXF entity to GeoJSON Feature
 */
function convertEntityToFeature(
  entity: DXFEntity,
  index: number
): GeoJSONFeature | null {
  const properties = {
    layer: entity.layer || 'NO_LAYER',
    dxfType: entity.type,
    handle: entity.handle,
    id: `entity_${index}`,
  };

  switch (entity.type) {
    case "LINE":
      return createLineFeature(entity, properties);

    case "LWPOLYLINE":
    case "POLYLINE":
      return createPolylineFeature(entity, properties);

    case "ARC":
      return createArcFeature(entity, properties);

    case "CIRCLE":
      return createCircleFeature(entity, properties);

    case "INSERT":
      return createInsertFeature(entity, properties);

    case "TEXT":
    case "MTEXT":
      return createTextFeature(entity, properties);

    case "ELLIPSE":
      return createEllipseFeature(entity, properties);

    case "SOLID":
      return createSolidFeature(entity, properties);

    case "ATTDEF":
      return createAttDefFeature(entity, properties);

    case "3DFACE":
      return create3DFaceFeature(entity, properties);

    default:
      console.log(`Unsupported entity type: ${entity.type}`);
      // Create a basic point feature for unsupported types
      return createPointFeature(entity, properties);
  }
}

function createLineFeature(
  entity: DXFEntity,
  properties: Record<string, any>
): GeoJSONFeature | null {
  if (!entity.vertices || entity.vertices.length < 2) {
    return null;
  }

  return {
    type: "Feature",
    properties: properties,
    geometry: {
      type: "LineString",
      coordinates: entity.vertices.map((vertex) => [vertex.x, vertex.y]),
    },
  };
}

function createPolylineFeature(
  entity: DXFEntity,
  properties: Record<string, any>
): GeoJSONFeature | null {
  if (!entity.vertices || entity.vertices.length === 0) {
    return null;
  }

  const coordinates = entity.vertices.map((vertex) => [vertex.x, vertex.y]);

  // Close the polyline if it's closed
  if (entity.closed && coordinates.length > 2) {
    coordinates.push(coordinates[0]);
  }

  const geometryType =
    entity.closed && coordinates.length > 3 ? "Polygon" : "LineString";

  return {
    type: "Feature",
    properties: properties,
    geometry: {
      type: geometryType,
      coordinates: geometryType === "Polygon" ? [coordinates] : coordinates,
    },
  };
}

function createArcFeature(
  entity: DXFEntity,
  properties: Record<string, any>
): GeoJSONFeature | null {
  // Convert ARC to LineString approximation
  const coordinates: number[][] = [];
  const numPoints = 12;
  const startAngle = entity.startAngle || 0;
  const endAngle = entity.endAngle || 2 * Math.PI;
  const radius = entity.radius || 1;
  const center = entity.center || { x: 0, y: 0, z: 0 };

  for (let i = 0; i <= numPoints; i++) {
    const angle = startAngle + (endAngle - startAngle) * (i / numPoints);
    const x = center.x + radius * Math.cos(angle);
    const y = center.y + radius * Math.sin(angle);
    coordinates.push([x, y]);
  }

  return {
    type: "Feature",
    properties: properties,
    geometry: {
      type: "LineString",
      coordinates: coordinates,
    },
  };
}

function createCircleFeature(
  entity: DXFEntity,
  properties: Record<string, any>
): GeoJSONFeature | null {
  const coordinates: number[][] = [];
  const numPoints = 16;
  const radius = entity.radius || 1;
  const center = entity.center || { x: 0, y: 0, z: 0 };

  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    const x = center.x + radius * Math.cos(angle);
    const y = center.y + radius * Math.sin(angle);
    coordinates.push([x, y]);
  }

  coordinates.push(coordinates[0]);

  return {
    type: "Feature",
    properties: properties,
    geometry: {
      type: "Polygon",
      coordinates: [coordinates],
    },
  };
}

function createInsertFeature(
  entity: DXFEntity,
  properties: Record<string, any>
): GeoJSONFeature | null {
  const position = entity.position || { x: 0, y: 0, z: 0 };

  return {
    type: "Feature",
    properties: {
      ...properties,
      blockName: entity.name,
      blockRotation: entity.rotation || 0,
    },
    geometry: {
      type: "Point",
      coordinates: [position.x, position.y],
    },
  };
}

function createTextFeature(
  entity: DXFEntity,
  properties: Record<string, any>
): GeoJSONFeature | null {
  const position = entity.position || { x: 0, y: 0, z: 0 };

  // Extract actual text from MTEXT formatting
  let actualText = entity.text || "";

  if (entity.type === "MTEXT" || entity.type === "TEXT") {
    // Handle MTEXT format: {\fFont|styles;actual_text}
    if (actualText.includes(";")) {
      const parts = actualText.split(";");
      if (parts.length > 1) {
        // Get text after the last semicolon and remove any closing braces
        actualText = parts[parts.length - 1].replace(/}$/, "").trim();
      }
    }

    // If we still have formatting codes but no semicolon, try other extraction methods
    if (actualText.includes("\\f") && actualText.length < 10) {
      // Try to extract from a different property if available
      actualText = entity.string || entity.value || actualText;
    }
  }

  // If we ended up with very short text that might be formatting, check other properties
  if (
    actualText.length < 3 &&
    (actualText.includes("\\f") || actualText.includes("{"))
  ) {
    actualText = "Room Label"; // Fallback
  }

  console.log(
    `Text extraction - Original: "${entity.text}" -> Extracted: "${actualText}"`
  );

  return {
    type: "Feature",
    properties: {
      ...properties,
      text: actualText,
      textHeight: entity.textHeight || 1,
      category: "label",
      originalText: entity.text, // Keep original for debugging
    },
    geometry: {
      type: "Point",
      coordinates: [position.x, position.y],
    },
  };
}

function createEllipseFeature(
  entity: DXFEntity,
  properties: Record<string, any>
): GeoJSONFeature | null {
  const position = entity.position || { x: 0, y: 0, z: 0 };
  return {
    type: "Feature",
    properties: properties,
    geometry: {
      type: "Point",
      coordinates: [position.x, position.y],
    },
  };
}

function createSolidFeature(
  entity: DXFEntity,
  properties: Record<string, any>
): GeoJSONFeature | null {
  // Convert SOLID to Polygon
  if (entity.corners && entity.corners.length >= 3) {
    const coordinates = entity.corners.map((corner: any) => [corner.x, corner.y]);
    // Close the polygon
    coordinates.push(coordinates[0]);
    return {
      type: "Feature",
      properties: properties,
      geometry: {
        type: "Polygon",
        coordinates: [coordinates],
      },
    };
  }
  return null;
}

function createAttDefFeature(
  entity: DXFEntity,
  properties: Record<string, any>
): GeoJSONFeature | null {
  // ATTDEF is like TEXT but for block attributes
  const position = entity.position || { x: 0, y: 0, z: 0 };
  let actualText = entity.text || entity.default || "";

  return {
    type: "Feature",
    properties: {
      ...properties,
      text: actualText,
      category: "attribute",
    },
    geometry: {
      type: "Point",
      coordinates: [position.x, position.y],
    },
  };
}

function create3DFaceFeature(
  entity: DXFEntity,
  properties: Record<string, any>
): GeoJSONFeature | null {
  // Convert 3DFACE to Polygon
  const corners = [entity.first, entity.second, entity.third, entity.fourth].filter(Boolean);
  if (corners.length >= 3) {
    const coordinates = corners.map((corner: any) => [corner.x, corner.y]);
    // Close the polygon
    coordinates.push(coordinates[0]);
    return {
      type: "Feature",
      properties: properties,
      geometry: {
        type: "Polygon",
        coordinates: [coordinates],
      },
    };
  }
  return null;
}

function createPointFeature(
  entity: DXFEntity,
  properties: Record<string, any>
): GeoJSONFeature | null {
  const position = entity.position || { x: 0, y: 0, z: 0 };
  return {
    type: "Feature",
    properties: properties,
    geometry: {
      type: "Point",
      coordinates: [position.x, position.y],
    },
  };
}