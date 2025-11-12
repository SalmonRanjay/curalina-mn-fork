import { Router } from "express";
import { db } from "./db";
import { products } from "@shared/schema";
import { sql, isNotNull } from "drizzle-orm";

const router = Router();

// Quiz configuration - these are the actual options users can select
const QUIZ_ROOM_TYPES = [
  "Living Room",
  "Bedroom", 
  "Dining Room",
  "Office",
  "Kitchen"
];

const QUIZ_STYLES = [
  "Modern",
  "Midcentury",
  "Scandinavian",
  "Industrial",
  "Bohemian",
  "Coastal",
  "Traditional",
  "Organic Modern"
];

const QUIZ_FEATURES = [
  "Natural Light",
  "Storage Solutions",
  "Workspace",
  "Ample Seating",
  "Greenery",
  "Art Display",
  "Cozy Ambiance",
  "Open Layout"
];

/**
 * GET /api/admin/mapping-analysis
 * Returns comprehensive mapping analysis between quiz options and product database values
 */
router.get("/mapping-analysis", async (req, res) => {
  try {
    // Get all products
    const allProducts = await db.select().from(products);

    // Analyze room types
    const roomTypeValues = new Map<string, number>();
    let productsWithRoomType = 0;
    let productsWithMismatchedRoomType: any[] = [];

    allProducts.forEach(product => {
      if (product.roomType && product.roomType.length > 0) {
        productsWithRoomType++;
        product.roomType.forEach(rt => {
          roomTypeValues.set(rt, (roomTypeValues.get(rt) || 0) + 1);
          
          // Check if this room type matches any quiz option (case-insensitive)
          const matchesQuizOption = QUIZ_ROOM_TYPES.some(qrt => 
            qrt.toLowerCase() === rt.toLowerCase()
          );
          
          if (!matchesQuizOption && productsWithMismatchedRoomType.length < 20) {
            productsWithMismatchedRoomType.push({
              id: product.id,
              sku: product.sku,
              name: product.name,
              roomType: product.roomType
            });
          }
        });
      }
    });

    const roomTypeProductValues = Array.from(roomTypeValues.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

    const unmappedRoomTypes = Array.from(roomTypeValues.keys())
      .filter(val => !QUIZ_ROOM_TYPES.some(qrt => qrt.toLowerCase() === val.toLowerCase()));

    // Analyze design styles
    const styleValues = new Map<string, number>();
    let productsWithStyle = 0;
    let productsWithMismatchedStyle: any[] = [];

    allProducts.forEach(product => {
      if (product.designStyle && product.designStyle.length > 0) {
        productsWithStyle++;
        product.designStyle.forEach(ds => {
          styleValues.set(ds, (styleValues.get(ds) || 0) + 1);
          
          // Check if matches quiz option (flexible matching)
          const matchesQuizOption = QUIZ_STYLES.some(qs => {
            const qsLower = qs.toLowerCase();
            const dsLower = ds.toLowerCase();
            return dsLower.includes(qsLower) || qsLower.includes(dsLower);
          });
          
          if (!matchesQuizOption && productsWithMismatchedStyle.length < 20) {
            productsWithMismatchedStyle.push({
              id: product.id,
              sku: product.sku,
              name: product.name,
              designStyle: product.designStyle
            });
          }
        });
      }
    });

    const styleProductValues = Array.from(styleValues.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

    const unmappedStyles = Array.from(styleValues.keys())
      .filter(val => !QUIZ_STYLES.some(qs => {
        const qsLower = qs.toLowerCase();
        const valLower = val.toLowerCase();
        return valLower.includes(qsLower) || qsLower.includes(valLower);
      }));

    // Analyze features
    const featureValues = new Map<string, number>();
    let productsWithFeatures = 0;

    allProducts.forEach(product => {
      if (product.keyFeatures && product.keyFeatures.length > 0) {
        productsWithFeatures++;
        product.keyFeatures.forEach(kf => {
          featureValues.set(kf, (featureValues.get(kf) || 0) + 1);
        });
      }
    });

    const featureProductValues = Array.from(featureValues.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

    // Analyze colors
    const colorValues = new Map<string, number>();
    let productsWithColors = 0;

    allProducts.forEach(product => {
      if (product.colors && product.colors.length > 0) {
        productsWithColors++;
        product.colors.forEach(c => {
          colorValues.set(c, (colorValues.get(c) || 0) + 1);
        });
      }
    });

    const topColors = Array.from(colorValues.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);

    // Calculate coverage percentages
    const totalProducts = allProducts.length;
    const roomTypeCoverage = Math.round((productsWithRoomType / totalProducts) * 100);
    const styleCoverage = Math.round((productsWithStyle / totalProducts) * 100);
    const featureCoverage = Math.round((productsWithFeatures / totalProducts) * 100);

    // Gap analysis
    const productsWithoutRoomType = totalProducts - productsWithRoomType;
    const productsWithoutStyle = totalProducts - productsWithStyle;
    const productsWithoutFeatures = totalProducts - productsWithFeatures;
    const productsWithoutColors = totalProducts - productsWithColors;

    const analysis = {
      roomTypes: {
        quizOptions: QUIZ_ROOM_TYPES,
        productValues: roomTypeProductValues,
        coverage: roomTypeCoverage,
        unmapped: unmappedRoomTypes
      },
      styles: {
        quizOptions: QUIZ_STYLES,
        productValues: styleProductValues,
        coverage: styleCoverage,
        unmapped: unmappedStyles
      },
      features: {
        quizOptions: QUIZ_FEATURES,
        productValues: featureProductValues,
        coverage: featureCoverage,
        unmapped: []
      },
      colors: {
        quizOptions: [],
        productValues: topColors,
        topColors: topColors
      },
      summary: {
        totalProducts,
        productsWithRoomType,
        productsWithStyle,
        productsWithFeatures,
        productsWithColors,
        avgMatchScore: Math.round((roomTypeCoverage + styleCoverage + featureCoverage) / 3)
      },
      gaps: {
        productsWithoutRoomType,
        productsWithoutStyle,
        productsWithoutFeatures,
        productsWithoutColors,
        productsWithMismatchedRoomType: productsWithMismatchedRoomType.slice(0, 10),
        productsWithMismatchedStyle: productsWithMismatchedStyle.slice(0, 10)
      }
    };

    res.json(analysis);
  } catch (error: any) {
    console.error("Error generating mapping analysis:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
