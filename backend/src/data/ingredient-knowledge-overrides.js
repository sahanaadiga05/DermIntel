function pubmed(title, url, evidenceType = "review") {
  return {
    title,
    url,
    source: "PubMed",
    evidenceType
  };
}

function dermnet(title, url, evidenceType = "clinical-reference") {
  return {
    title,
    url,
    source: "DermNet",
    evidenceType
  };
}

function pubchem(title, url, evidenceType = "reference") {
  return {
    title,
    url,
    source: "PubChem",
    evidenceType
  };
}

export const ingredientKnowledgeOverrides = {
  "water": {
    aliases: ["Aqua", "Purified Water"],
    functions: ["Solvent"],
    helps: [],
    avoidFor: [],
    evidenceLevel: "REFERENCE",
    references: [
      pubchem(
        "Water | H2O | CID 962",
        "https://pubchem.ncbi.nlm.nih.gov/compound/Purified%20Water"
      ),
      {
        title: "CosIng cosmetic ingredient database",
        url: "https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database_en",
        source: "European Commission",
        evidenceType: "regulatory-reference"
      }
    ]
  },
  "glycerin": {
    scientificName: "Glycerol",
    functions: ["Humectant", "Barrier Support", "Skin Conditioning"],
    helps: ["HYDRATION", "DEHYDRATION", "DRYNESS", "BARRIER_REPAIR"],
    avoidFor: [],
    evidenceLevel: "HIGH",
    references: [
      pubmed(
        "Glycerol and the skin: holistic approach to its origin and functions",
        "https://pubmed.ncbi.nlm.nih.gov/18510666/"
      ),
      pubmed(
        "Effects of Locally Applied Glycerol and Xylitol on the Hydration, Barrier Function and Morphological Parameters of the Skin",
        "https://pubmed.ncbi.nlm.nih.gov/27349297/",
        "clinical-study"
      )
    ]
  },
  "niacinamide": {
    scientificName: "Nicotinamide",
    aliases: ["Vitamin B3", "Nicotinamide"],
    functions: ["Barrier Repair", "Sebum Control", "Brightening", "Anti-inflammatory"],
    helps: [
      "ACNE",
      "PIGMENTATION",
      "DARK_SPOTS",
      "UNEVEN_SKIN_TONE",
      "REDNESS",
      "EXCESS_OIL",
      "BARRIER_REPAIR",
      "ANTI_AGING"
    ],
    avoidFor: [],
    evidenceLevel: "HIGH",
    references: [
      pubmed(
        "Niacinamide - mechanisms of action and its topical use in dermatology",
        "https://pubmed.ncbi.nlm.nih.gov/24993939/"
      ),
      pubmed(
        "Mechanistic Basis and Clinical Evidence for the Applications of Nicotinamide (Niacinamide) to Control Skin Aging and Pigmentation",
        "https://pubmed.ncbi.nlm.nih.gov/34439563/"
      ),
      pubmed(
        "Evidence-based topical treatments (azelaic acid, salicylic acid, nicotinamide, sulfur, zinc, and fruit acid) for acne: an abridged version of a Cochrane systematic review",
        "https://pubmed.ncbi.nlm.nih.gov/33034949/",
        "systematic-review"
      )
    ]
  },
  "salicylic acid": {
    functions: ["Keratolytic", "Exfoliant", "Comedolytic", "Sebum Control"],
    helps: ["ACNE", "EXCESS_OIL", "SMOOTH_TEXTURE", "LARGE_PORES"],
    avoidFor: [],
    evidenceLevel: "MODERATE",
    references: [
      pubmed(
        "Evidence-based topical treatments (azelaic acid, salicylic acid, nicotinamide, sulfur, zinc, and fruit acid) for acne: an abridged version of a Cochrane systematic review",
        "https://pubmed.ncbi.nlm.nih.gov/33034949/",
        "systematic-review"
      ),
      pubmed(
        "Treatment of acne vulgaris with salicylic acid pads",
        "https://pubmed.ncbi.nlm.nih.gov/1535287/",
        "clinical-review"
      )
    ]
  },
  "ceramide np": {
    aliases: ["Ceramide NP", "Ceramide"],
    functions: ["Barrier Repair", "Water Retention Support", "Skin Conditioning"],
    helps: ["BARRIER_REPAIR", "DRYNESS", "DEHYDRATION", "HYDRATION"],
    avoidFor: [],
    evidenceLevel: "MODERATE",
    references: [
      pubmed(
        "Ceramides in Skin Health and Disease: An Update",
        "https://pubmed.ncbi.nlm.nih.gov/34283373/"
      ),
      pubmed(
        "Clinical significance of the water retention and barrier function-improving capabilities of ceramide-containing formulations: A qualitative review",
        "https://pubmed.ncbi.nlm.nih.gov/34596254/"
      )
    ]
  },
  "hyaluronic acid": {
    aliases: ["Hyaluronic Acid", "Hyaluronan"],
    functions: ["Humectant", "Film Forming", "Skin Replenishing"],
    helps: ["HYDRATION", "DEHYDRATION", "ANTI_AGING", "SMOOTH_TEXTURE"],
    avoidFor: [],
    evidenceLevel: "MODERATE",
    references: [
      pubmed(
        "Benefits of topical hyaluronic acid for skin quality and signs of skin aging: From literature review to clinical evidence",
        "https://pubmed.ncbi.nlm.nih.gov/36200921/"
      ),
      pubmed(
        "Hyaluronic Acid in Topical Applications: The Various Forms and Biological Effects of a Hero Molecule in the Cosmetics Industry",
        "https://pubmed.ncbi.nlm.nih.gov/41463312/"
      )
    ]
  },
  "sodium hyaluronate": {
    aliases: ["Sodium Hyaluronate", "Hyaluronate"],
    functions: ["Humectant", "Film Forming", "Skin Replenishing"],
    helps: ["HYDRATION", "DEHYDRATION", "ANTI_AGING", "SMOOTH_TEXTURE"],
    avoidFor: [],
    evidenceLevel: "MODERATE",
    references: [
      pubmed(
        "Benefits of topical hyaluronic acid for skin quality and signs of skin aging: From literature review to clinical evidence",
        "https://pubmed.ncbi.nlm.nih.gov/36200921/"
      ),
      pubmed(
        "Hyaluronic Acid in Topical Applications: The Various Forms and Biological Effects of a Hero Molecule in the Cosmetics Industry",
        "https://pubmed.ncbi.nlm.nih.gov/41463312/"
      )
    ]
  },
  "panthenol": {
    aliases: ["Panthenol", "Pro-vitamin B5", "Vitamin B5"],
    functions: ["Humectant", "Soothing", "Barrier Support"],
    helps: ["BARRIER_REPAIR", "HYDRATION", "DRYNESS", "REDNESS"],
    avoidFor: [],
    evidenceLevel: "MODERATE",
    references: [
      pubmed(
        "Topical use of dexpanthenol: a 70th anniversary article",
        "https://pubmed.ncbi.nlm.nih.gov/28503966/"
      )
    ]
  },
  "petrolatum": {
    functions: ["Occlusive", "Barrier Support", "Emollient"],
    helps: ["BARRIER_REPAIR", "DRYNESS", "DEHYDRATION", "HYDRATION"],
    avoidFor: [],
    evidenceLevel: "HIGH",
    references: [
      pubmed(
        "Effects of petrolatum on stratum corneum structure and function",
        "https://pubmed.ncbi.nlm.nih.gov/1564142/",
        "clinical-study"
      ),
      pubmed(
        "Petrolatum: Barrier repair and antimicrobial responses underlying this \"inert\" moisturizer",
        "https://pubmed.ncbi.nlm.nih.gov/26431582/",
        "clinical-study"
      )
    ]
  },
  "centella asiatica extract": {
    aliases: ["Centella Asiatica Extract", "Gotu Kola", "Cica"],
    functions: ["Soothing", "Barrier Support", "Antioxidant Support"],
    helps: ["REDNESS", "BARRIER_REPAIR", "SMOOTH_TEXTURE"],
    avoidFor: [],
    evidenceLevel: "MODERATE",
    references: [
      pubmed(
        "A Systematic Review of the Effect of Centella asiatica on Wound Healing",
        "https://pubmed.ncbi.nlm.nih.gov/35328954/",
        "systematic-review"
      ),
      pubmed(
        "Topical Application of Centella asiatica in Wound Healing: Recent Insights into Mechanisms and Clinical Efficacy",
        "https://pubmed.ncbi.nlm.nih.gov/39458583/"
      )
    ]
  },
  "aloe barbadensis leaf juice": {
    aliases: ["Aloe Vera", "Aloe Barbadensis Leaf Juice"],
    functions: ["Soothing", "Humectant", "Film Forming"],
    helps: ["BARRIER_REPAIR", "HYDRATION"],
    avoidFor: [],
    evidenceLevel: "MIXED",
    references: [
      pubmed(
        "The Review on Properties of Aloe Vera in Healing of Cutaneous Wounds",
        "https://pubmed.ncbi.nlm.nih.gov/26090436/"
      ),
      pubmed(
        "Aloe vera for treating acute and chronic wounds",
        "https://pubmed.ncbi.nlm.nih.gov/22336851/",
        "systematic-review"
      )
    ]
  },
  "azelaic acid": {
    functions: ["Brightening", "Anti-inflammatory", "Keratolytic", "Comedolytic"],
    helps: ["ACNE", "PIGMENTATION", "DARK_SPOTS", "REDNESS", "UNEVEN_SKIN_TONE", "SMOOTH_TEXTURE"],
    avoidFor: [],
    evidenceLevel: "HIGH",
    references: [
      pubmed(
        "The versatility of azelaic acid in dermatology",
        "https://pubmed.ncbi.nlm.nih.gov/32730109/"
      ),
      pubmed(
        "Evidence-based topical treatments (azelaic acid, salicylic acid, nicotinamide, sulfur, zinc, and fruit acid) for acne: an abridged version of a Cochrane systematic review",
        "https://pubmed.ncbi.nlm.nih.gov/33034949/",
        "systematic-review"
      )
    ]
  },
  "fragrance": {
    aliases: ["Fragrance", "Parfum", "Perfume"],
    functions: ["Fragrance"],
    helps: [],
    avoidFor: ["SENSITIVE", "FRAGRANCE_ALLERGY"],
    evidenceLevel: "HIGH",
    references: [
      dermnet(
        "Fragrance allergy",
        "https://dermnetnz.org/topics/fragrance-allergy"
      ),
      dermnet(
        "Contact reactions to cosmetics",
        "https://dermnetnz.org/topics/contact-reactions-to-cosmetics"
      )
    ]
  },
  "cocamidopropyl betaine": {
    aliases: ["Cocamidopropyl Betaine"],
    functions: ["Surfactant", "Cleansing", "Foaming"],
    helps: [],
    avoidFor: ["COCAMIDOPROPYL_BETAINE_ALLERGY"],
    evidenceLevel: "MODERATE",
    references: [
      pubmed(
        "Contact allergy to cocamidopropyl betaine",
        "https://pubmed.ncbi.nlm.nih.gov/8706401/",
        "clinical-study"
      )
    ]
  },
  "tocopherol": {
    aliases: ["Vitamin E", "Tocopherol"],
    functions: ["Antioxidant", "Skin Conditioning"],
    helps: ["ANTI_AGING", "SMOOTH_TEXTURE"],
    avoidFor: [],
    evidenceLevel: "MODERATE",
    references: [
      pubmed(
        "Safety Assessment of Tocopherols and Tocotrienols as Used in Cosmetics",
        "https://pubmed.ncbi.nlm.nih.gov/30235959/",
        "safety-review"
      ),
      pubmed(
        "Patch Testing With Tocopherol and Tocopherol Acetate: The North American Contact Dermatitis Group Experience, 2001 to 2016",
        "https://pubmed.ncbi.nlm.nih.gov/34238818/",
        "clinical-study"
      )
    ]
  },
  "coconut oil": {
    aliases: ["Cocos Nucifera Oil", "Coconut Oil"],
    functions: ["Emollient", "Occlusive", "Skin Conditioning"],
    helps: ["DRYNESS", "HYDRATION", "BARRIER_REPAIR"],
    avoidFor: [],
    evidenceLevel: "MODERATE",
    references: [
      pubmed(
        "The effect of topical virgin coconut oil on SCORAD index, transepidermal water loss, and skin capacitance in mild to moderate pediatric atopic dermatitis: a randomized, double-blind, clinical trial",
        "https://pubmed.ncbi.nlm.nih.gov/24320105/",
        "clinical-study"
      ),
      pubmed(
        "In vitro anti-inflammatory and skin protective properties of Virgin coconut oil",
        "https://pubmed.ncbi.nlm.nih.gov/30671361/",
        "preclinical-study"
      )
    ]
  },
  "camellia sinensis leaf extract": {
    aliases: ["Green Tea Extract", "Camellia Sinensis Leaf Extract"],
    functions: ["Antioxidant", "Soothing", "Barrier Support"],
    helps: ["REDNESS", "HYDRATION", "ANTI_AGING"],
    avoidFor: [],
    evidenceLevel: "MODERATE",
    references: [
      pubmed(
        "Pleiotropic effects of a Camellia sinensis leaf extract on in vitro and in vivo skin health characteristics",
        "https://pubmed.ncbi.nlm.nih.gov/40391588/"
      )
    ]
  },
  "oryza sativa extract": {
    aliases: ["Rice Extract", "Oryza Sativa Extract", "Rice Bran Extract"],
    functions: ["Antioxidant Support", "Skin Conditioning", "Hydration Support"],
    helps: ["HYDRATION", "ANTI_AGING", "PIGMENTATION"],
    avoidFor: [],
    evidenceLevel: "MODERATE",
    references: [
      pubmed(
        "Dermatological uses of rice products: Trend or true?",
        "https://pubmed.ncbi.nlm.nih.gov/35587098/"
      ),
      pubmed(
        "Antioxidant activities and skin hydration effects of rice bran bioactive compounds entrapped in niosomes",
        "https://pubmed.ncbi.nlm.nih.gov/21449379/",
        "clinical-study"
      )
    ]
  },
  "zinc pca": {
    aliases: ["Zinc PCA", "Zinc Pyrrolidone Carboxylic Acid"],
    functions: ["Sebum Control", "Skin Conditioning", "Antimicrobial Support"],
    helps: ["ACNE", "EXCESS_OIL"],
    avoidFor: [],
    evidenceLevel: "MODERATE",
    references: [
      pubmed(
        "Efficacy and Tolerability of Topical Nicotinamide Plus Antibacterial Adhesive Agents and Zinc-Pyrrolidone Carboxylic Acid Versus Placebo as an Adjuvant Treatment for Moderate Acne Vulgaris in Indonesia: A Multicenter, Double-blind, Randomized, Controlled Trial",
        "https://pubmed.ncbi.nlm.nih.gov/32983333/",
        "clinical-study"
      )
    ]
  },
  "phenoxyethanol": {
    aliases: ["Phenoxyethanol", "2-Phenoxyethanol"],
    functions: ["Preservative"],
    helps: [],
    avoidFor: ["PRESERVATIVE_ALLERGY"],
    evidenceLevel: "HIGH",
    references: [
      pubmed(
        "Safety review of phenoxyethanol when used as a preservative in cosmetics",
        "https://pubmed.ncbi.nlm.nih.gov/31588615/",
        "safety-review"
      ),
      pubmed(
        "Patch Testing to Methyldibromoglutaronitrile/Phenoxyethanol: North American Contact Dermatitis Group Experience, 1994-2018",
        "https://pubmed.ncbi.nlm.nih.gov/33675328/",
        "clinical-study"
      )
    ]
  },
  "alcohol denat": {
    aliases: ["Alcohol Denat", "Denatured Alcohol", "Ethanol"],
    functions: ["Solvent", "Penetration Enhancer", "Astringent"],
    helps: ["EXCESS_OIL"],
    avoidFor: ["SENSITIVE", "DRY"],
    evidenceLevel: "MODERATE",
    references: [
      pubmed(
        "Safety evaluation of topical applications of ethanol on the skin and inside the oral cavity",
        "https://pubmed.ncbi.nlm.nih.gov/19014531/",
        "safety-review"
      ),
      pubmed(
        "Final report of the safety assessment of Alcohol Denat., including SD Alcohol 3-A, SD Alcohol 30, SD Alcohol 39, SD Alcohol 39-B, SD Alcohol 39-C, SD Alcohol 40, SD Alcohol 40-B, and SD Alcohol 40-C, and the denaturants, Quassin, Brucine Sulfate/Brucine, and Denatonium Benzoate",
        "https://pubmed.ncbi.nlm.nih.gov/18569160/",
        "safety-review"
      )
    ]
  },
  "sodium cocoyl isethionate": {
    aliases: ["Sodium Cocoyl Isethionate", "SCI"],
    functions: ["Surfactant", "Cleansing", "Foaming"],
    helps: [],
    avoidFor: [],
    evidenceLevel: "MODERATE",
    references: [
      pubmed(
        "Visualization and quantification of skin barrier perturbation induced by surfactant-humectant systems using two-photon fluorescence microscopy",
        "https://pubmed.ncbi.nlm.nih.gov/18818848/",
        "preclinical-study"
      ),
      pubmed(
        "Fatty acid sulphoalkyl amides and esters as cosmetic surfactants",
        "https://pubmed.ncbi.nlm.nih.gov/19467117/",
        "review"
      )
    ]
  },
  "menthol": {
    aliases: ["Menthol"],
    functions: ["Cooling Agent", "Counter-Irritant", "Fragrance"],
    helps: [],
    avoidFor: ["SENSITIVE"],
    evidenceLevel: "MODERATE",
    references: [
      pubmed(
        "The role and mechanism of action of menthol in topical analgesic products",
        "https://pubmed.ncbi.nlm.nih.gov/29524352/",
        "review"
      ),
      pubmed(
        "Effect of topically applied menthol on thermal, pain and itch sensations and biophysical properties of the skin",
        "https://pubmed.ncbi.nlm.nih.gov/8738567/",
        "clinical-study"
      )
    ]
  },
  "cetearyl alcohol": {
    aliases: ["Cetearyl Alcohol", "Cetostearyl Alcohol"],
    functions: ["Emollient", "Emulsion Stabilizer", "Texture Modifier"],
    helps: ["DRYNESS", "HYDRATION"],
    avoidFor: [],
    evidenceLevel: "LOW",
    references: [
      pubmed(
        "Skin contact allergy to emulsifiers",
        "https://pubmed.ncbi.nlm.nih.gov/19456905/",
        "clinical-study"
      )
    ]
  },
  "sodium benzoate": {
    aliases: ["Sodium Benzoate"],
    functions: ["Preservative"],
    helps: [],
    avoidFor: ["PRESERVATIVE_ALLERGY"],
    evidenceLevel: "MODERATE",
    references: [
      pubmed(
        "Sodium Benzoate as an Emerging but Problematic Allergen: Retrospective Analysis of Patch Test Results in 3198 Cases Underlines the Need for an Improved Test Preparation, as Even Dubious Reactions May Be Clinically Relevant",
        "https://pubmed.ncbi.nlm.nih.gov/40342057/",
        "clinical-study"
      )
    ]
  },
  "pantolactone": {
    aliases: ["Pantolactone"],
    functions: ["Humectant", "Skin Conditioning"],
    helps: [],
    avoidFor: ["PANTOLACTONE_ALLERGY"],
    evidenceLevel: "LOW",
    references: [
      pubchem(
        "(+)-Pantolactone | C6H10O3 | CID 736053",
        "https://pubchem.ncbi.nlm.nih.gov/compound/736053"
      ),
      pubmed(
        "Allergic contact dermatitis from pantolactone and dexpanthenol in wound healing creams",
        "https://pubmed.ncbi.nlm.nih.gov/35946606/",
        "clinical-study"
      )
    ]
  },
  "xanthan gum": {
    aliases: ["Xanthan Gum"],
    functions: ["Viscosity Controlling", "Stabilizer", "Film Forming"],
    helps: [],
    avoidFor: [],
    evidenceLevel: "MODERATE",
    references: [
      pubmed(
        "Safety Assessment of Microbial Polysaccharide Gums as Used in Cosmetics",
        "https://pubmed.ncbi.nlm.nih.gov/27383198/",
        "safety-review"
      ),
      pubmed(
        "Re-evaluation of xanthan gum (E 415) as a food additive",
        "https://pubmed.ncbi.nlm.nih.gov/32625570/",
        "safety-review"
      )
    ]
  },
  "citric acid": {
    aliases: ["Citric Acid"],
    functions: ["pH Adjuster", "Chelating Agent"],
    helps: [],
    avoidFor: [],
    evidenceLevel: "HIGH",
    references: [
      pubmed(
        "Safety Assessment of Citric Acid, Inorganic Citrate Salts, and Alkyl Citrate Esters as Used in Cosmetics",
        "https://pubmed.ncbi.nlm.nih.gov/24861367/",
        "safety-review"
      )
    ]
  },
  "trehalose": {
    aliases: ["Trehalose", "Alpha,alpha-trehalose"],
    functions: ["Humectant", "Skin Conditioning"],
    helps: ["HYDRATION", "DEHYDRATION"],
    avoidFor: [],
    evidenceLevel: "MODERATE",
    references: [
      pubmed(
        "Safety Assessment of Monosaccharides, Disaccharides, and Related Ingredients as Used in Cosmetics",
        "https://pubmed.ncbi.nlm.nih.gov/31170840/",
        "safety-review"
      ),
      pubmed(
        "Trehalose: a review of properties, history of use and human tolerance, and results of multiple safety studies",
        "https://pubmed.ncbi.nlm.nih.gov/12065209/",
        "review"
      )
    ]
  },
  "sodium c14 16 alpha olefin sulfonate": {
    aliases: ["Sodium C14-16 Olefin Sulfonate", "Sodium Alpha-Olefin Sulfonate", "Alpha Olefin Sulfonate"],
    functions: ["Surfactant", "Cleansing", "Foaming"],
    helps: [],
    avoidFor: ["SENSITIVE", "DRY"],
    evidenceLevel: "MODERATE",
    references: [
      pubmed(
        "Sodium Alpha-Olefin Sulfonates",
        "https://pubmed.ncbi.nlm.nih.gov/37769698/",
        "safety-review"
      ),
      {
        title: "Sodium olefinsulfonate inert reassessment document",
        url: "https://www.epa.gov/ingredients-used-pesticide-products/inert-reassessment-document-sodium-olefinsulfonate-cas-no-68439",
        source: "EPA",
        evidenceType: "regulatory-reference"
      }
    ]
  }
};