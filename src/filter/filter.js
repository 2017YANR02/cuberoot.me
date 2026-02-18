/**
 * filter.js - Production-ready Solution Filtering System
 * 
 * Statistical and cluster-based filtering for Rubik's Cube solutions
 * Optimized for adaptive labeling with quality-based strategies
 * 
 * Based on solutionFilter.js with production-ready optimizations:
 * - Pre-computed physical cost matrix for efficiency
 * - Clean module exports for Node.js integration
 * - All core functions preserved from solutionFilter.js
 * 
 * @version 2.0
 * @date 2026-01-11
 */

const MOVE_NAMES = [
    "U", "U2", "U'", "D", "D2", "D'",
    "L", "L2", "L'", "R", "R2", "R'",
    "F", "F2", "F'", "B", "B2", "B'"
];

/**
 * Calculate QTM (Quarter Turn Metric)
 * 180° rotation is counted as operation amount 2
 * 
 * @param {Array<number>} moves - Array of steps
 * @returns {number} - QTM value
 */
function calculateQTM(moves) {
    let qtm = 0;
    for (const move of moves) {
        const moveType = move % 3; // 0: 90°, 1: 180°, 2: -90°
        if (moveType === 1) {
            qtm += 2; // 180° rotation counts as 2
        } else {
            qtm += 1; // 90° or -90° is 1 count
        }
    }
    return qtm;
}

/**
 * Calculate HTM (Half Turn Metric)
 * 180° rotation is also counted as operation amount 1
 * 
 * @param {Array<number>} moves - Array of steps
 * @returns {number} - HTM value
 */
function calculateHTM(moves) {
    return moves.length; // Every rotation counts as 1
}

// ============================================================================
// Physical Cost Matrix (Pre-computed for efficiency)
// ============================================================================

/**
 * Pre-computed 18x18 physical cost matrix
 * Based on move transition costs:
 * - Same move: 0.0
 * - Same face, different rotation: 0.5 (e.g., U → U2)
 * - Same axis, opposite faces: 1.0 (e.g., U → D)
 * - Different axes: 0.7 (e.g., U → R, U → F)
 */
const PHYSICAL_COST = (() => {
    const matrix = Array(18).fill(0).map(() => Array(18).fill(0));
    for (let moveA = 0; moveA < 18; moveA++) {
        for (let moveB = 0; moveB < 18; moveB++) {
            if (moveA === moveB) {
                matrix[moveA][moveB] = 0.0;
            } else {
                const faceA = Math.floor(moveA / 3);
                const faceB = Math.floor(moveB / 3);
                if (faceA === faceB) {
                    matrix[moveA][moveB] = 0.5;
                } else {
                    const axisA = Math.floor(faceA / 2);
                    const axisB = Math.floor(faceB / 2);
                    matrix[moveA][moveB] = (axisA === axisB) ? 1.0 : 0.7;
                }
            }
        }
    }
    return matrix;
})();

// ============================================================================
// Core Functions
// ============================================================================

function stringToAlg(str) {
    if (!str || str.trim() === "") return [];
    return str.trim().split(/\s+/).map(name => MOVE_NAMES.indexOf(name)).filter(i => i !== -1);
}

/**
 * Weighted edit distance using pre-computed physical costs
 * @param {number[]} a - First move sequence
 * @param {number[]} b - Second move sequence
 * @returns {number} - Weighted edit distance
 */
function computeAdvancedEditDistance(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Float64Array(n + 1));
    for (let i = 0; i <= m; ++i) dp[i][0] = i;
    for (let j = 0; j <= n; ++j) dp[0][j] = j;

    for (let i = 1; i <= m; ++i) {
        for (let j = 1; j <= n; ++j) {
            if (a[i - 1] === b[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                const sub_cost = PHYSICAL_COST[a[i - 1]][b[j - 1]];
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1.0,
                    dp[i][j - 1] + 1.0,
                    dp[i - 1][j - 1] + sub_cost
                );
            }
        }
    }
    return dp[m][n];
}

/**
 * For school classification: similarity calculation with emphasis on the second half
 * “The middle point we are aiming for is the same” = the second half (last 3-5 moves) are similar
 * 
 * Important: Same rotation/face used just in different order = physically the same operation
 * 
 * @param {Array<number>} a - Step A
 * @param {Array<number>} b - Smooth B
 * @returns {number} - Similarity (0～1)
 */
function calculateEndSimilarity(a, b) {
    // Decide the length of the second half according to the length of the procedure
    const avgLength = (a.length + b.length) / 2;
    let endChunkSize;
    if (avgLength <= 7) {
        endChunkSize = 3; // Short answer: last 3 moves
    } else if (avgLength <= 10) {
        endChunkSize = 4; // Medium: Last 4 moves
    } else {
        endChunkSize = 5; // Long solution: last 5 moves
    }
    
    // Extract the second half
    const endA = a.slice(-endChunkSize);
    const endB = b.slice(-endChunkSize);
    
    if (endA.length < 2 || endB.length < 2) {
        return 0;
    }
    
    // 1. Second half exact match check
    if (endA.length === endB.length && endA.every((val, i) => val === endB[i])) {
        return 1.0; // exact match
    }
    
    // 2. Partial match check in the second half (detects patterns with different order)
    const setA = new Set(endA);
    const setB = new Set(endB);
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    const jaccardSimilarity = union.size > 0 ? intersection.size / union.size : 0;
    
    // 3. Similarity of surfaces of revolution (if only the surfaces of revolution are similar)
    // The sides are the same, just the arrangement is different = It is likely that the operations are physically the same
    const facesA = endA.map(m => Math.floor(m / 3)); // 0-5: U,D,F,B,R,L
    const facesB = endB.map(m => Math.floor(m / 3));
    const faceSetA = new Set(facesA);
    const faceSetB = new Set(facesB);
    const faceIntersection = new Set([...faceSetA].filter(x => faceSetB.has(x)));
    const faceUnion = new Set([...faceSetA, ...faceSetB]);
    const faceSimilarity = faceUnion.size > 0 ? faceIntersection.size / faceUnion.size : 0;
    
    // 4. Edit distance based similarity
    const editDist = computeAdvancedEditDistance(endA, endB);
    const maxDist = Math.max(endA.length, endB.length) * 3; // maximum cost
    const editSimilarity = maxDist > 0 ? 1 - (editDist / maxDist) : 0;
    
    // Overall similarity (weighted average)
    // Emphasis on similarity of rotation surfaces (to detect differences in arrangement order)
    // Note: Hardcoded weights for backward compatibility
    // Use calculateEndSimilarityConfigurable for custom weights
    return jaccardSimilarity * 0.3 + editSimilarity * 0.3 + faceSimilarity * 0.4;
}

/**
 * Configurable version of calculateEndSimilarity
 * @param {Array<number>} a - Step A
 * @param {Array<number>} b - Step B
 * @param {Object} config - Configuration {endFaceWeight, endSequenceWeight}
 * @returns {number} - Similarity (0-1)
 */
function calculateEndSimilarityConfigurable(a, b, config = {}) {
    const { endFaceWeight = 40, endSequenceWeight = 40, focusMoves = 5 } = config;
    
    // Use focusMoves parameter for end chunk size
    const endChunkSize = focusMoves;
    
    // For short solutions, use the entire sequence
    // If solution is shorter than focusMoves, use all available moves
    const endA = a.length <= endChunkSize ? a : a.slice(-endChunkSize);
    const endB = b.length <= endChunkSize ? b : b.slice(-endChunkSize);
    
    // If either solution is too short (less than 2 moves), fall back to simple comparison
    if (endA.length < 2 || endB.length < 2) {
        // For very short solutions, use exact match
        if (a.length === b.length && a.every((val, i) => val === b[i])) {
            return 1.0;
        }
        return 0;
    }
    
    // 1. Exact match check
    if (endA.length === endB.length && endA.every((val, i) => val === endB[i])) {
        return 1.0;
    }
    
    // 2. Jaccard similarity
    const setA = new Set(endA);
    const setB = new Set(endB);
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    const jaccardSimilarity = union.size > 0 ? intersection.size / union.size : 0;
    
    // 3. Face similarity
    const facesA = endA.map(m => Math.floor(m / 3));
    const facesB = endB.map(m => Math.floor(m / 3));
    const faceSetA = new Set(facesA);
    const faceSetB = new Set(facesB);
    const faceIntersection = new Set([...faceSetA].filter(x => faceSetB.has(x)));
    const faceUnion = new Set([...faceSetA, ...faceSetB]);
    const faceSimilarity = faceUnion.size > 0 ? faceIntersection.size / faceUnion.size : 0;
    
    // 4. Edit distance similarity
    const editDist = computeAdvancedEditDistance(endA, endB);
    const maxDist = Math.max(endA.length, endB.length) * 3;
    const editSimilarity = maxDist > 0 ? 1 - (editDist / maxDist) : 0;
    
    // Calculate dynamic weights
    // endFaceWeight: weight for face similarity
    // endSequenceWeight: weight for sequence similarity (Jaccard + Edit distance)
    // Remaining weight: distributed between Jaccard and Edit distance
    const usedWeight = endFaceWeight + endSequenceWeight;
    const remainingWeight = 100 - usedWeight;
    const jaccardWeight = endSequenceWeight * 0.5;  // Half of sequence weight to Jaccard
    const editWeight = endSequenceWeight * 0.5;     // Half of sequence weight to Edit distance
    
    // Normalize to 0-1 range
    return (jaccardSimilarity * jaccardWeight + editSimilarity * editWeight + faceSimilarity * endFaceWeight) / 100;
}

/**
 * For subgroup division: position-weighted chunk similarity
 * Consider the first half as well to classify "ways to the midpoint" within the school
 * 
 * Criteria for evaluating strategic similarity:
 * 1) The first half is similar (only the last few moves are different) → Most strategically similar (weight 3.5)
 * 2) The middle is similar → Moderately strategically similar (weight 2.0)
 * 3) The second half is similar → Slightly strategically similar (weight 1.5)
 * 4) No similar parts → Strategically different (weight 0)
 */
function calculateChunkSimilarityForSubgroup(a, b, chunkSize = 3) {
    if (a.length < chunkSize || b.length < chunkSize) {
        return 0; // Cannot create chunks
    }

    // Extract chunks from a with position information
    const chunksA = new Map(); // chunk -> [positions]
    for (let i = 0; i <= a.length - chunkSize; i++) {
        const chunk = a.slice(i, i + chunkSize).join(',');
        if (!chunksA.has(chunk)) {
            chunksA.set(chunk, []);
        }
        chunksA.get(chunk).push(i);
    }

    // Extract chunks from b with position information
    const chunksB = new Map();
    for (let i = 0; i <= b.length - chunkSize; i++) {
        const chunk = b.slice(i, i + chunkSize).join(',');
        if (!chunksB.has(chunk)) {
            chunksB.set(chunk, []);
        }
        chunksB.get(chunk).push(i);
    }

    // Find common chunks and calculate position-based weights
    let weightedSimilarity = 0;
    let maxPossibleWeight = 0;

    for (const [chunk, positionsA] of chunksA.entries()) {
        if (chunksB.has(chunk)) {
            const positionsB = chunksB.get(chunk);
            
            // Get the most forward position from both positions
            const minPosA = Math.min(...positionsA);
            const minPosB = Math.min(...positionsB);
            
            // Normalized positions (0 to 1)
            const normPosA = minPosA / Math.max(1, a.length - chunkSize);
            const normPosB = minPosB / Math.max(1, b.length - chunkSize);
            const avgPos = (normPosA + normPosB) / 2;
            
            // Position-based weighting
            // First half (0-0.4): weight 3.5 - Most strategically similar
            // Middle (0.4-0.7): weight 2.0 - Moderately strategically similar
            // Second half (0.7-1.0): weight 1.5 - Slightly strategically similar
            let positionWeight;
            if (avgPos < 0.4) {
                positionWeight = 3.5;
            } else if (avgPos < 0.7) {
                positionWeight = 2.0;
            } else {
                positionWeight = 1.5;
            }
            
            weightedSimilarity += positionWeight;
        }
    }

    // Maximum possible weight for all chunks (assuming they are in the first half)
    const totalUniqueChunks = new Set([...chunksA.keys(), ...chunksB.keys()]).size;
    maxPossibleWeight = totalUniqueChunks * 3.5;

    // Normalized similarity (0 to 1)
    return maxPossibleWeight > 0 ? weightedSimilarity / maxPossibleWeight : 0;
}

/**
 * Multi-scale chunk similarity (for subgroup division)
 * Calculate similarity with emphasis on the first half using combinations of 3, 4, and 5 moves
 */
function calculateMultiScaleChunkSimilarity(a, b) {
    let totalSimilarity = 0;
    let weights = 0;

    // 3-move chunks (weight 1.5, basic pattern)
    const sim3 = calculateChunkSimilarityForSubgroup(a, b, 3);
    if (!isNaN(sim3)) {
        totalSimilarity += sim3 * 1.5;
        weights += 1.5;
    }

    // 4-move chunks (weight 2.5, more specific patterns)
    const sim4 = calculateChunkSimilarityForSubgroup(a, b, 4);
    if (!isNaN(sim4)) {
        totalSimilarity += sim4 * 2.5;
        weights += 2.5;
    }

    // 5-move chunks (weight 3.5, very distinctive patterns)
    const sim5 = calculateChunkSimilarityForSubgroup(a, b, 5);
    if (!isNaN(sim5)) {
        totalSimilarity += sim5 * 3.5;
        weights += 3.5;
    }

    return weights > 0 ? totalSimilarity / weights : 0;
}

/**
 * Distance calculation for school classification (emphasizing the latter half)
 * Determine whether the targeted intermediate points are the same
 */
function computeSchoolDistance(a, b, config = {}) {
    // Pass focusMoves through config
    const endSim = calculateEndSimilarityConfigurable(a, b, config);
    
    // Higher similarity in the latter half = smaller distance
    // Similarity 1.0 → Distance 0, Similarity 0.0 → Distance 10
    return (1 - endSim) * 10;
}

/**
 * Extended edit distance (for subgroup division)   
 * Detect differences in the first half using traditional distance + chunk similarity
 */
function computeEnhancedDistance(a, b) {
    const editDist = computeAdvancedEditDistance(a, b);
    const chunkSim = calculateMultiScaleChunkSimilarity(a, b);
    
    // The higher the chunk similarity, the more the distance is reduced
    // Maximum 50% reduction with editDist * (1 - chunkSim * 0.5) (increased from previous 30%)
    // This makes similar solutions judged as closer
    return editDist * (1 - chunkSim * 0.5);
}

/**
 * Silhouette coefficient calculation
 * Evaluate the quality of each sample's cluster (-1 to 1, closer to 1 is better)
 */
function calculateSilhouette(idx, clusterIdx, families, allMoves) {
    const currentCluster = families[clusterIdx].memberIndices;

    // a: Average distance within the same cluster
    let a = 0;
    for (let j of currentCluster) {
        if (j !== idx) {
            a += computeAdvancedEditDistance(allMoves[idx], allMoves[j]);
        }
    }
    a = currentCluster.length > 1 ? a / (currentCluster.length - 1) : 0;

    // b: Average distance to the nearest other cluster
    let b = Infinity;
    for (let i = 0; i < families.length; i++) {
        if (i === clusterIdx) continue;
        let dist = 0;
        for (let j of families[i].memberIndices) {
            dist += computeAdvancedEditDistance(allMoves[idx], allMoves[j]);
        }
        dist /= families[i].memberIndices.length;
        b = Math.min(b, dist);
    }

    return b === Infinity ? 0 : (b - a) / Math.max(a, b);
}

/**
 * k-medoids (PAM) based representative selection
 * Select a more robust central point
 */
function selectMedoid(memberIndices, allMoves) {
    if (memberIndices.length === 1) return memberIndices[0];

    let bestMedoid = memberIndices[0];
    let minTotalCost = Infinity;

    // Select from the shortest sequences
    const minLen = Math.min(...memberIndices.map(idx => allMoves[idx].length));
    const candidates = memberIndices.filter(idx => allMoves[idx].length === minLen);

    for (let i of candidates) {
        let totalCost = 0;
        for (let j of memberIndices) {
            totalCost += computeAdvancedEditDistance(allMoves[i], allMoves[j]);
        }
        if (totalCost < minTotalCost) {
            minTotalCost = totalCost;
            bestMedoid = i;
        }
    }

    return bestMedoid;
}

/**
 * Statistical outlier detection (Modified Z-Score method)
 * Detect steps that are extremely far from the representative within a cluster
 */
function detectOutliers(family, allMoves, threshold = 3.5) {
    if (family.memberIndices.length < 3) return [];

    const leaderMoves = allMoves[family.leaderIdx];
    const distances = family.memberIndices.map(idx =>
        computeAdvancedEditDistance(leaderMoves, allMoves[idx])
    );

    // Uses MAD (Median Absolute Deviation)
    const median = distances.slice().sort((a, b) => a - b)[Math.floor(distances.length / 2)];
    const mad = distances.map(d => Math.abs(d - median))
        .sort((a, b) => a - b)[Math.floor(distances.length / 2)];

    const outliers = [];
    family.memberIndices.forEach((idx, i) => {
        const modifiedZ = 0.6745 * (distances[i] - median) / (mad + 1e-10);
        if (Math.abs(modifiedZ) > threshold) {
            outliers.push(idx);
        }
    });

    return outliers;
}



/**
 * Cluster quality based merging (enhanced)
 * Merge small, low-quality clusters to solve the problem of overly fragmented styles
 */
function mergeSmallClusters(families, allMoves, minSize = 3, maxMergeDistance = 6) {
    let merged = [...families];
    let changed = true;
    
    // Iterative merging (until convergence)
    while (changed) {
        changed = false;
        const newMerged = [];
        const toMerge = [];

        merged.forEach(family => {
            if (family.memberIndices.length < minSize) {
                toMerge.push(family);
            } else {
                newMerged.push(family);
            }
        });

        // Merge small clusters into the nearest large cluster
        toMerge.forEach(smallFamily => {
            let bestTarget = null;
            let minDist = Infinity;

            newMerged.forEach(largeFamily => {
                const dist = computeAdvancedEditDistance(
                    allMoves[smallFamily.leaderIdx],
                    allMoves[largeFamily.leaderIdx]
                );
                if (dist < minDist) {
                    minDist = dist;
                    bestTarget = largeFamily;
                }
            });

            // Merge if within maxMergeDistance, otherwise keep
            if (bestTarget && minDist <= maxMergeDistance) {
                bestTarget.memberIndices.push(...smallFamily.memberIndices);
                changed = true;
            } else {
                newMerged.push(smallFamily);
            }
        });
        
        merged = newMerged;
    }
    
    // Further merge nearby large clusters to prevent excessive fragmentation
    let finalMerged = [];
    const used = new Set();
    
    for (let i = 0; i < merged.length; i++) {
        if (used.has(i)) continue;
        
        const family1 = merged[i];
        let combined = { ...family1, memberIndices: [...family1.memberIndices] };
        
        for (let j = i + 1; j < merged.length; j++) {
            if (used.has(j)) continue;
            
            const family2 = merged[j];
            const dist = computeAdvancedEditDistance(
                allMoves[family1.leaderIdx],
                allMoves[family2.leaderIdx]
            );
            
            // Merge if both are small (less than minSize * 2) and close in distance
            if (dist <= 3 && 
                family1.memberIndices.length < minSize * 2 && 
                family2.memberIndices.length < minSize * 2) {
                combined.memberIndices.push(...family2.memberIndices);
                used.add(j);
            }
        }
        
        finalMerged.push(combined);
        used.add(i);
    }
    
    // Recalculate medoids after merging
    finalMerged.forEach(family => {
        family.leaderIdx = selectMedoid(family.memberIndices, allMoves);
    });

    return finalMerged;
}

/**
 * Division of subgroups within schools
 * Divide into subgroups within a style aiming for the same intermediate point but with different approaches (first half)
 * 
 * @param {Object} family - Style object {leaderIdx, memberIndices}
 * @param {Array<Array<number>>} allMoves - All sequences
 * @param {number} threshold - Threshold for subgroup division (default: 3)
 * @returns {Array<Object>} - Array of subgroups [{leaderIdx, memberIndices}, ...]
 */
function divideIntoSubgroups(family, allMoves, threshold = 3) {
    const subgroups = [];
    const { memberIndices } = family;
    
    if (memberIndices.length < 3) {
        // Do not divide small styles into subgroups
        return [{ leaderIdx: memberIndices[0], memberIndices: [...memberIndices] }];
    }
    
    // Divide into subgroups using Sequential Leader Clustering
    // Here, use a distance that emphasizes the first half (computeEnhancedDistance)
    for (const idx of memberIndices) {
        let joined = false;
        for (const subgroup of subgroups) {
            const dist = computeEnhancedDistance(allMoves[idx], allMoves[subgroup.leaderIdx]);
            if (dist <= threshold) {
                subgroup.memberIndices.push(idx);
                joined = true;
                break;
            }
        }
        if (!joined) {
            subgroups.push({ leaderIdx: idx, memberIndices: [idx] });
        }
    }
    
    // Recalculate medoids for each subgroup
    subgroups.forEach(subgroup => {
        if (subgroup.memberIndices.length >= 2) {
            subgroup.leaderIdx = selectMedoid(subgroup.memberIndices, allMoves);
        }
    });
    
    // Sort subgroups by size (descending)
    subgroups.sort((a, b) => b.memberIndices.length - a.memberIndices.length);
    
    return subgroups;
}



/**
 * Calculate recommendation score for a solution (improved version)
 * Note: Length-based scoring removed to avoid redundancy with QTM penalties
 * QTM penalties in the main labeling logic handle move count efficiency
 */
function calculateRecommendationScore(idx, family, familyRank, allMoves, families, config = {}) {
    const { rankWeight = 1.0, sizeWeight = 1.0 } = config;
    const solution = allMoves[idx];
    const representative = allMoves[family.leaderIdx];

    // Normalization scale for consistent impact across parameters
    const PENALTY_SCALE = 10;

    // 1. Style size score (larger styles get higher scores)
    const maxFamilySize = Math.max(...families.map(f => f.memberIndices.length));
    const sizeScore = family.memberIndices.length / maxFamilySize;

    // 2. Style rank score (higher-ranked styles get higher scores)
    // More strict: School_1=1.0, School_2=0.5, School_3=0.33...
    const rankScore = Math.pow(0.5, familyRank);

    // 3. Distance score from representative (using enhanced distance, considering chunk similarity)
    const distance = computeEnhancedDistance(solution, representative);
    const maxDist = family.memberIndices.reduce((max, i) => {
        const d = computeEnhancedDistance(allMoves[i], representative);
        return Math.max(max, d);
    }, 0);
    const distanceScore = maxDist > 0 ? 1 - distance / maxDist : 1;

    // 4. Silhouette coefficient (cluster quality)
    const silhouette = calculateSilhouette(idx, familyRank, families, allMoves);
    // More strict: silhouette<0 is 0 points, only silhouette>0 is scored
    const silhouetteScore = Math.max(0, silhouette); // 0 to 1 (negative is 0)

    // 5. Improved representativeness evaluation (relative evaluation within styles)
    // High bonus for shortest solution within the style
    const familyMinLength = Math.min(...family.memberIndices.map(i => allMoves[i].length));
    const isFamilyShortest = solution.length === familyMinLength ? 1.0 : 0.0;
    
    // Medium bonus for representative solution
    const isRepresentative = idx === family.leaderIdx ? 0.7 : 0.0;
    
    // Higher of shortest within style or representative
    const representativeScore = Math.max(isFamilyShortest, isRepresentative);

    // Weighted total score (normalized to ~100 points)
    // All weights are normalized: multiplier=1.0 gives ~10 point impact
    const normalizedRankScore = rankScore * rankWeight * PENALTY_SCALE * 4.0;  // School rank (×4 because pow(0.5, rank) makes smaller values)
    const normalizedSizeScore = sizeScore * sizeWeight * PENALTY_SCALE * 3.0;  // School size (×3 for balance)
    
    // Remaining fixed weights (not user-adjustable)
    const distanceWeight = 15;       // Distance from Representative
    const silhouetteWeight = 12;     // Cluster quality
    const representativeWeight = 3;  // Representativeness
    
    const totalScore = (
        normalizedRankScore +                  // School rank (~40 points at weight=1.0)
        normalizedSizeScore +                  // School size (~30 points at weight=1.0)
        distanceScore * distanceWeight +       // Distance from Representative (15 points)
        silhouetteScore * silhouetteWeight +   // Cluster quality (12 points)
        representativeScore * representativeWeight // Representativeness (3 points)
    );

    return totalScore;
}



/**
 * Statistically improved main logic (with recommendation scores) 
 * 
 * @param {string[]} rawMovesList - Array of move sequence strings
 * @param {number} threshold - Clustering threshold (default: 4)
 * @param {number} prefixLen - Prefix length (default: 4)
 * @returns {Object[]|null[]} - Classification results for each move sequence
 * 
 * Return structure:
 * {
 *   school: string,              // School name (e.g., "School_1")
 *   label: string,               // Label: "Representative" | "Shortest" | "Other"
 *   prefix: string,              // First N moves of the sequence (e.g., "U R D F")
 *   schoolRank: number,          // Rank of the school (1 is the largest school)
 *   score: number,               // Recommendation score (0-100)
 *   recommendationRank: number,  // Overall recommendation rank
 *   totalCandidates: number      // Total number of labeled candidates
 * }
 * 
 * Returns null for outlier or low-quality solutions
 * 
 * Recommendation score calculation factors:
 * - Style Size (25%)
 * - Style Rank (20%)
 * - Length of the sequence (20%)
 * - Similarity to Representative (15%)
 * - Cluster Quality (10%)
 * - Representativeness Bonus (10%)
 */
function getFinalLabelList(rawMovesList, config = {}) {
    // Default settings
    const {
        threshold = 4,
        prefixLen = 4,
        minClusterSize = null,  // null means automatic adjustment
        maxClusterSize = 15,
        minSchoolSize = 3,
        subgroupThreshold = null,  // null means automatic adjustment
        minSubgroupSize = 3,
        outlierThreshold = 3.5, // not used currently
        qtmSubgroup = 0.3,
        qtmCase1 = 1.5,
        qtmFinal = 0.2,
        htmPenalty = 1.0,  // HTM penalty multiplier (0 = no HTM penalty, higher = stronger penalty)
        rotationEfficiencyBonus = 1.0,  // Rotation efficiency bonus multiplier (HTM/QTM ratio, higher efficiency = higher bonus)
        rankWeight = 1.0,  // School rank weight (multiplier for normalized score)
        sizeWeight = 1.0,  // School size weight (multiplier for normalized score)
        endFaceWeight = 40,
        endSequenceWeight = 40,
        focusMoves = 5  // Number of moves to focus on from the end for school classification
    } = config;

    const n = rawMovesList.length;
    if (n === 0) return [];

    const allMoves = rawMovesList.map(s => stringToAlg(s));
    
    // Normalization constants for penalties/bonuses
    // Designed so that multiplier=1.0 gives similar impact (~10 points) for typical solutions
    // NOTE: rankWeight and sizeWeight are also normalized to 10-point base
    const TYPICAL_HTM = 8;  // Typical solution length in HTM
    const TYPICAL_QTM = 10; // Typical solution length in QTM
    const TYPICAL_EFFICIENCY = 0.8; // Typical rotation efficiency (HTM/QTM)
    const PENALTY_SCALE = 10; // Scale factor for normalized penalties/bonuses
    
    // Dynamic threshold adjustment based on sample size
    // For small samples (around 100), use MDL recommended values and limit max cluster size
    let effectiveThreshold = threshold;
    let effectiveMaxClusterSize = maxClusterSize;
    if (n <= 150) {
        // Around 100: threshold 4-5, max cluster size 15
        effectiveThreshold = Math.max(threshold, 4);
        effectiveMaxClusterSize = Math.min(maxClusterSize, 15);
    } else if (n <= 500) {
        // Around 500: threshold 5, max cluster size 30
        effectiveThreshold = Math.max(threshold, 5);
        effectiveMaxClusterSize = Math.min(maxClusterSize, 30);
    }
    // Above 1000: use default threshold, no limit
    
    const families = []; // { leaderIdx, memberIndices }

    // 1. Clustering (Sequential Leader-based Clustering with emphasis on the latter half)
    // "Same target intermediate point" = solutions with similar latter halves belong to the same style
    for (let i = 0; i < n; ++i) {
        let joined = false;
        for (let family of families) {
            // Check max cluster size
            if (family.memberIndices.length >= effectiveMaxClusterSize) continue;
            
            // Use distance emphasizing the latter half for style classification
            if (computeSchoolDistance(allMoves[i], allMoves[family.leaderIdx], { endFaceWeight, endSequenceWeight, focusMoves }) <= effectiveThreshold) {
                family.memberIndices.push(i);
                joined = true;
                break;
            }
        }
        if (!joined) {
            families.push({ leaderIdx: i, memberIndices: [i] });
        }
    }

    // 2. Representative selection using k-medoids (PAM)
    families.forEach(family => {
        family.leaderIdx = selectMedoid(family.memberIndices, allMoves);
    });

    // 3. Merging small clusters
    // Adjust minSize based on sample size (only if config value is null)
    let actualMinClusterSize = minClusterSize;
    if (actualMinClusterSize === null) {
        actualMinClusterSize = 2;
        if (n <= 150) {
            actualMinClusterSize = 5; // Around 100: minimum 5 (to differentiate from smallest styles)
        } else if (n <= 500) {
            actualMinClusterSize = 3; // Around 500: minimum 3
        }
    }
    const mergedFamilies = mergeSmallClusters(families, allMoves, actualMinClusterSize, effectiveThreshold + 2);

    // 4. Sort by size of the style
    mergedFamilies.sort((a, b) => b.memberIndices.length - a.memberIndices.length);

    // 4.5. Filter out too small Schools (exclude Schools with fewer members than minSchoolSize)
    // This prevents isolated or meaningless small Schools from being included in the results
    // Excluded solutions are treated as "unique solutions that do not belong to any style"
    // To further subdivide within styles, the styles themselves are kept relatively large
    const validFamilies = mergedFamilies.filter(family => family.memberIndices.length >= minSchoolSize);
    
    // If all families are excluded, keep at least the largest family
    const finalFamilies = validFamilies.length > 0 ? validFamilies : [mergedFamilies[0]].filter(f => f);

    // 5. Labeling process (new approach: subgroup-based)
    // Flow: divide into subgroups within styles → select best solution from each subgroup → labeling
    const finalLabels = Array(n).fill(null);
    const getPrefixStr = (moveArr) => moveArr.slice(0, prefixLen).map(idx => MOVE_NAMES[idx]).join(' ') || "None";
    
    // Map to store subgroup information for each solution (including unlabeled ones)
    const subgroupInfoMap = new Map(); // idx -> { subgroupIndex, subgroupSize, totalSubgroups }

    finalFamilies.forEach((family, rank) => {
        const schoolName = `School_${rank + 1}`;
        const schoolRank = rank + 1; // 1-based
        
        // A. Divide into subgroups within styles (classified by differences in the first half)
        // Adjust subgroup division threshold based on sample size (only if config value is null)
        const actualSubgroupThreshold = subgroupThreshold !== null ? subgroupThreshold : (n <= 150 ? 2.5 : 3.0);
        const subgroups = divideIntoSubgroups(family, allMoves, actualSubgroupThreshold);
        
        // B. Subgroup quality evaluation
        const subgroupsWithQuality = subgroups.map(subgroup => {
            const avgLength = subgroup.memberIndices.reduce((sum, idx) => 
                sum + allMoves[idx].length, 0) / subgroup.memberIndices.length;
            const minLength = Math.min(...subgroup.memberIndices.map(idx => allMoves[idx].length));
            
            // Subgroup score: size + shortness of moves
            const sizeScore = subgroup.memberIndices.length;
            // Length penalty: penalize longer sequences (avoid negative by using penalty instead of bonus)
            // Typical minLength is 4-12, so we use a penalty approach
            const lengthPenalty = Math.max(0, minLength - 4) * 0.5; // Penalty for lengths above 4
            const totalScore = sizeScore * 3 - lengthPenalty;
            
            return {
                ...subgroup,
                size: subgroup.memberIndices.length,
                minLength: minLength,
                avgLength: avgLength,
                score: totalScore
            };
        });
        
        // C. Sort subgroups by score
        subgroupsWithQuality.sort((a, b) => b.score - a.score);
        
        // Store subgroup information for ALL members (not just valid subgroups)
        // This ensures all solutions have subgroup information displayed
        const totalSubgroups = subgroupsWithQuality.length;
        
        subgroupsWithQuality.forEach((subgroup, subgroupIndex) => {
            subgroup.memberIndices.forEach(idx => {
                subgroupInfoMap.set(idx, {
                    subgroupIndex: subgroupIndex,
                    subgroupSize: subgroup.size,
                    totalSubgroups: totalSubgroups
                });
            });
        });
        
        // D. Get the shortest move count in the entire style
        const schoolMinLength = Math.min(...family.memberIndices.map(idx => allMoves[idx].length));
        
        // E. Select Representative/Alternative from each subgroup
        const usedPrefixesInSchool = new Set();
        
        // Check if subgroups are validly formed
        const validSubgroups = subgroupsWithQuality.filter(sg => sg.size >= minSubgroupSize);
        const hasValidSubgroups = validSubgroups.length > 0;
        
        subgroupsWithQuality.forEach((subgroup, subgroupIndex) => {
            // Skip small subgroups (belong to style but no label)
            if (subgroup.size < minSubgroupSize) {
                return;
            }
            
            // Select the best solution within the subgroup
            // Priority: 1) Shortest, 2) QTM efficiency, 3) Recommendation score, 4) Prefix diversity
            const candidates = subgroup.memberIndices.map(idx => {
                const length = allMoves[idx].length;
                const qtm = calculateQTM(allMoves[idx]);
                const htm = calculateHTM(allMoves[idx]);
                const prefix = getPrefixStr(allMoves[idx]);
                const recScore = calculateRecommendationScore(idx, family, rank, allMoves, finalFamilies, { rankWeight, sizeWeight });
                
                // Overall score with normalized penalties/bonuses (each ~10 points at multiplier=1.0)
                // Length penalty: penalize if longer than schoolMinLength + 3
                const lengthPenalty = Math.max(0, length - (schoolMinLength + 3)) * 5;
                // Normalized HTM penalty: (htm / TYPICAL_HTM) * multiplier * SCALE
                const htmPenaltyValue = (htm / TYPICAL_HTM) * htmPenalty * PENALTY_SCALE;
                // Normalized QTM penalty: (qtm / TYPICAL_QTM) * multiplier * SCALE
                const qtmPenalty = (qtm / TYPICAL_QTM) * qtmSubgroup * PENALTY_SCALE;
                // Normalized efficiency bonus: (efficiency / TYPICAL_EFFICIENCY) * multiplier * SCALE
                const efficiency = qtm > 0 ? htm / qtm : 1.0;
                const efficiencyBonus = (efficiency / TYPICAL_EFFICIENCY) * rotationEfficiencyBonus * PENALTY_SCALE;
                const totalScore = recScore - lengthPenalty - htmPenaltyValue - qtmPenalty + efficiencyBonus;
                
                return { idx, length, qtm, prefix, score: totalScore };
            });
            
            // Sort by score
            candidates.sort((a, b) => b.score - a.score);
            
            // Select from top candidates with unused prefix
            let selectedCandidate = null;
            for (const candidate of candidates) {
                if (!usedPrefixesInSchool.has(candidate.prefix) || 
                    (n <= 150 && rank === 0)) { // Allow prefix duplication for small sample School_1
                    selectedCandidate = candidate;
                    break;
                }
            }
            
            if (!selectedCandidate) {
                return; // Could not select due to prefix duplication
            }
            
            // F. Label determination
            let label;
            let bonusScore = 0;
            
            if (subgroupIndex === 0) {
                // First subgroup (largest and best) → Representative
                label = "Representative";
                bonusScore = rank === 0 ? 20 : (rank < 3 ? 15 : 10);
            } else if (selectedCandidate.length === schoolMinLength && subgroupIndex < 3) {
                // Shortest solutions in top 3 subgroups → Shortest Alternative
                label = "Shortest Alternative";
                bonusScore = 8;
            } else if (subgroupIndex < 5 && selectedCandidate.length <= schoolMinLength + 2) {
                // Short solutions in top 5 subgroups → Alternative
                label = "Alternative";
                bonusScore = 5;
            } else if (subgroupIndex < 7 && selectedCandidate.length <= schoolMinLength + 1) {
                // Very short solutions in top 7 subgroups → Member
                label = "Member";
                bonusScore = 2;
            } else {
                // No label assigned otherwise (belongs to style but not displayed)
                return;
            }
            
            // G. Label assignment
            finalLabels[selectedCandidate.idx] = {
                school: schoolName,
                label: label,
                prefix: selectedCandidate.prefix,
                schoolRank: schoolRank,
                score: Math.min(100, selectedCandidate.score + bonusScore),
                subgroupIndex: subgroupIndex,
                subgroupSize: subgroup.size,
                totalSubgroups: subgroupsWithQuality.length
            };
            
            usedPrefixesInSchool.add(selectedCandidate.prefix);
        });
        
        // H. Alternative supplementation process
        // Case 1: No subgroups formed (all distinct)
        //   → The one with the best QTM efficiency is Representative, the next 1-2 best are Alternative
        // Case 2: Only one subgroup formed
        //   → The best solution in that subgroup is Representative
        //   → From the solutions that could not form subgroups, 1-2 with good QTM efficiency are Alternative
        
        const validSubgroupCount = subgroupsWithQuality.filter(sg => sg.size >= minSubgroupSize).length;
        
        if (validSubgroupCount === 0) {
            // Case 1: No subgroups formed (all distinct)
            // The one with the best QTM efficiency is Representative, the next 1-2 best are Alternative
            const allCandidates = family.memberIndices.map(idx => {
                const length = allMoves[idx].length;
                const qtm = calculateQTM(allMoves[idx]);
                const htm = calculateHTM(allMoves[idx]);
                const prefix = getPrefixStr(allMoves[idx]);
                const recScore = calculateRecommendationScore(idx, family, rank, allMoves, finalFamilies, { rankWeight, sizeWeight });
                
                // Score with normalized penalties/bonuses (HTM NOT used in Case 1)
                // NOTE: HTM is NOT used here because subgroup formation failed (HTM doesn't differentiate well)
                // Length penalty: penalize if longer than schoolMinLength + 3
                const lengthPenalty = Math.max(0, length - (schoolMinLength + 3)) * 5;
                // Normalized QTM penalty: (qtm / TYPICAL_QTM) * multiplier * SCALE
                const qtmPenalty = (qtm / TYPICAL_QTM) * qtmCase1 * PENALTY_SCALE;
                // Normalized efficiency bonus
                const efficiency = qtm > 0 ? htm / qtm : 1.0;
                const efficiencyBonus = (efficiency / TYPICAL_EFFICIENCY) * rotationEfficiencyBonus * PENALTY_SCALE;
                const totalScore = recScore - lengthPenalty - qtmPenalty + efficiencyBonus;
                
                return { idx, length, qtm, prefix, score: totalScore };
            });
            
            // Sort by QTM and score (QTM prioritized)
            allCandidates.sort((a, b) => {
                if (a.qtm !== b.qtm) return a.qtm - b.qtm;
                return b.score - a.score;
            });
            
            // Select Representative + Alternative (1-2)
            const targetCount = rank === 0 ? 3 : 2; // School_1 has 3, others have 2
            let labeledCount = 0;
            
            for (const candidate of allCandidates) {
                if (labeledCount >= targetCount) break;
                if (usedPrefixesInSchool.has(candidate.prefix) && !(n <= 150 && rank === 0)) {
                    continue;
                }
                
                let label, bonusScore;
                if (labeledCount === 0) {
                    label = "Representative";
                    bonusScore = rank === 0 ? 20 : (rank < 3 ? 15 : 10);
                } else if (candidate.length === schoolMinLength) {
                    label = "Shortest Alternative";
                    bonusScore = 8;
                } else {
                    label = "Alternative";
                    bonusScore = 5;
                }
                
                finalLabels[candidate.idx] = {
                    school: schoolName,
                    label: label,
                    prefix: candidate.prefix,
                    schoolRank: schoolRank,
                    score: Math.min(100, candidate.score + bonusScore),
                    subgroupIndex: null,
                    subgroupSize: null,
                    totalSubgroups: 0
                };
                
                usedPrefixesInSchool.add(candidate.prefix);
                labeledCount++;
            }
            
        } else if (validSubgroupCount === 1) {
            // Case 2: Only one subgroup formed
            // Representative is already selected, supplement Alternatives
            const targetAlternatives = rank === 0 ? 2 : 1;
            const currentAlternatives = Object.values(finalLabels).filter(label => 
                label && label.school === schoolName && 
                (label.label === "Alternative" || label.label === "Shortest Alternative")
            ).length;
            
            if (currentAlternatives < targetAlternatives) {
                // Collect candidates from solutions that could not form subgroups
                const unassignedCandidates = [];
                
                family.memberIndices.forEach(idx => {
                    if (finalLabels[idx] === null) {
                        const length = allMoves[idx].length;
                        const qtm = calculateQTM(allMoves[idx]);
                        const prefix = getPrefixStr(allMoves[idx]);
                        
                        if (length <= schoolMinLength + 2 && !usedPrefixesInSchool.has(prefix)) {
                            const recScore = calculateRecommendationScore(idx, family, rank, allMoves, finalFamilies, { rankWeight, sizeWeight });
                            // Normalized HTM penalty
                            const htm = calculateHTM(allMoves[idx]);
                            const htmPenaltyValue = (htm / TYPICAL_HTM) * htmPenalty * PENALTY_SCALE;
                            // Normalized QTM penalty
                            const qtmPenalty = (qtm / TYPICAL_QTM) * 1.0 * PENALTY_SCALE;
                            // Normalized efficiency bonus
                            const efficiency = qtm > 0 ? htm / qtm : 1.0;
                            const efficiencyBonus = (efficiency / TYPICAL_EFFICIENCY) * rotationEfficiencyBonus * PENALTY_SCALE;
                            const totalScore = recScore - htmPenaltyValue - qtmPenalty + efficiencyBonus;
                            
                            unassignedCandidates.push({ idx, length, qtm, prefix, score: totalScore });
                        }
                    }
                });
                
                // Sort by QTM and score (QTM prioritized)
                unassignedCandidates.sort((a, b) => {
                    if (a.qtm !== b.qtm) return a.qtm - b.qtm;
                    return b.score - a.score;
                });
                
                // Supplement the shortage
                const neededCount = targetAlternatives - currentAlternatives;
                const promotedCandidates = unassignedCandidates.slice(0, neededCount);
                
                promotedCandidates.forEach(candidate => {
                    const label = candidate.length === schoolMinLength ? 
                        "Shortest Alternative" : "Alternative";
                    const bonusScore = candidate.length === schoolMinLength ? 8 : 5;
                    
                    finalLabels[candidate.idx] = {
                        school: schoolName,
                        label: label,
                        prefix: candidate.prefix,
                        schoolRank: schoolRank,
                        score: Math.min(100, candidate.score + bonusScore),
                        subgroupIndex: null,
                        subgroupSize: null,
                        totalSubgroups: 1
                    };
                    
                    usedPrefixesInSchool.add(candidate.prefix);
                });
            }
        } else {
            // Case 3: Multiple subgroups formed (normal case)
            // Supplement if there are few Alternatives just in case
            const targetAlternatives = rank === 0 ? 2 : 1;
            const currentAlternatives = Object.values(finalLabels).filter(label => 
                label && label.school === schoolName && 
                (label.label === "Alternative" || label.label === "Shortest Alternative")
            ).length;
            
            if (currentAlternatives < targetAlternatives) {
                const unassignedCandidates = [];
                
                family.memberIndices.forEach(idx => {
                    if (finalLabels[idx] === null) {
                        const length = allMoves[idx].length;
                        const qtm = calculateQTM(allMoves[idx]);
                        const prefix = getPrefixStr(allMoves[idx]);
                        
                        if (length <= schoolMinLength + 2 && !usedPrefixesInSchool.has(prefix)) {
                            const recScore = calculateRecommendationScore(idx, family, rank, allMoves, finalFamilies, { rankWeight, sizeWeight });
                            // Normalized HTM penalty
                            const htm = calculateHTM(allMoves[idx]);
                            const htmPenaltyValue = (htm / TYPICAL_HTM) * htmPenalty * PENALTY_SCALE;
                            // Normalized QTM penalty
                            const qtmPenalty = (qtm / TYPICAL_QTM) * 1.0 * PENALTY_SCALE;
                            // Normalized efficiency bonus
                            const efficiency = qtm > 0 ? htm / qtm : 1.0;
                            const efficiencyBonus = (efficiency / TYPICAL_EFFICIENCY) * rotationEfficiencyBonus * PENALTY_SCALE;
                            const totalScore = recScore - htmPenaltyValue - qtmPenalty + efficiencyBonus;
                            
                            unassignedCandidates.push({ idx, length, qtm, prefix, score: totalScore });
                        }
                    }
                });
                
                unassignedCandidates.sort((a, b) => {
                    if (a.qtm !== b.qtm) return a.qtm - b.qtm;
                    return b.score - a.score;
                });
                
                const neededCount = targetAlternatives - currentAlternatives;
                const promotedCandidates = unassignedCandidates.slice(0, neededCount);
                
                promotedCandidates.forEach(candidate => {
                    const label = candidate.length === schoolMinLength ? 
                        "Shortest Alternative" : "Alternative";
                    const bonusScore = candidate.length === schoolMinLength ? 8 : 5;
                    
                    finalLabels[candidate.idx] = {
                        school: schoolName,
                        label: label,
                        prefix: candidate.prefix,
                        schoolRank: schoolRank,
                        score: Math.min(100, candidate.score + bonusScore),
                        subgroupIndex: null,
                        subgroupSize: null,
                        totalSubgroups: validSubgroupCount
                    };
                    
                    usedPrefixesInSchool.add(candidate.prefix);
                });
            }
        }
    });

    // 6. Calculation of recommendation ranks
    // Flexible ranking considering School size + fine-tuning by QTM efficiency
    const labeledIndices = [];
    
    // Get School information (for size calculation)
    const schoolSizes = new Map();
    finalFamilies.forEach((family, idx) => {
        schoolSizes.set(`School_${idx + 1}`, family.memberIndices.length);
    });
    const maxSchoolSize = Math.max(...schoolSizes.values());
    
    finalLabels.forEach((label, idx) => {
        if (label !== null) {
            // Calculate adjustment score based on School size
            const schoolSize = schoolSizes.get(label.school) || 0;
            const sizeBonus = (schoolSize / maxSchoolSize) * 20; // Up to 20 points bonus
            
            // Basic bonus based on label
            let labelBonus = 0;
            if (label.label === 'Representative') {
                // Representatives are generally prioritized but suppressed in small Schools
                labelBonus = label.schoolRank === 1 ? 15 : 
                             label.schoolRank <= 3 ? 10 : 5;
            } else if (label.label === 'Shortest' || label.label === 'Shortest Alternative') {
                // Shortest reflects the value of length
                labelBonus = label.schoolRank === 1 ? 8 : 5;
            } else if (label.label === 'Alternative') {
                // Alternative
                labelBonus = 3;
            } else {
                // Member
                labelBonus = 0;
            }
            
            // Fine-tuning with normalized bonuses/penalties (each ~10 points at multiplier=1.0)
            const qtm = calculateQTM(allMoves[idx]);
            const htm = calculateHTM(allMoves[idx]);
            // Normalized HTM penalty
            const htmPenaltyValue = (htm / TYPICAL_HTM) * htmPenalty * PENALTY_SCALE;
            // Normalized QTM penalty (using qtmFinal multiplier)
            const qtmPenalty = (qtm / TYPICAL_QTM) * qtmFinal * PENALTY_SCALE;
            // Normalized efficiency bonus (scaled down for final ranking)
            const efficiency = qtm > 0 ? htm / qtm : 1.0;
            const efficiencyBonus = (efficiency / TYPICAL_EFFICIENCY) * rotationEfficiencyBonus * PENALTY_SCALE * 0.5;
            
            // Final adjusted score = original score + label bonus + size bonus - HTM penalty - QTM penalty + efficiency bonus
            const adjustedScore = label.score + labelBonus + sizeBonus - htmPenaltyValue - qtmPenalty + efficiencyBonus;
            
            labeledIndices.push({ 
                idx, 
                score: label.score,
                adjustedScore: adjustedScore,
                labelType: label.label,
                schoolRank: label.schoolRank,
                schoolSize: schoolSize
            });
        }
    });
    
    // Sort by adjusted score (this prioritizes Shortest/Member in large Schools)
    labeledIndices.sort((a, b) => b.adjustedScore - a.adjustedScore);

    const rankMap = new Map();
    labeledIndices.forEach((item, rank) => {
        rankMap.set(item.idx, rank + 1);
    });

    // 7. Construction of final results (adding recommendationRank)
    // Return Unlabeled object instead of null
    const result = finalLabels.map((label, idx) => {
        if (label === null) {
            // Search for cases where it belongs to a cluster but has no label
            for (const family of finalFamilies) {
                if (family.memberIndices.includes(idx)) {
                    // Belongs to a cluster but is not Rep/Shortest/Member
                    const schoolIndex = finalFamilies.indexOf(family);
                    const qtm = calculateQTM(allMoves[idx]);
                    const htm = calculateHTM(allMoves[idx]);
                    
                    // Get subgroup information from the map
                    const subgroupInfo = subgroupInfoMap.get(idx);
                    
                    return {
                        school: `School_${schoolIndex + 1}`,
                        label: "Unlabeled",
                        prefix: "",
                        schoolRank: schoolIndex + 1,
                        score: 0,
                        qtm: qtm,
                        htm: htm,
                        originalIdx: idx,
                        recommendationRank: null,
                        totalCandidates: labeledIndices.length,
                        subgroupIndex: subgroupInfo ? subgroupInfo.subgroupIndex : null,
                        subgroupSize: subgroupInfo ? subgroupInfo.subgroupSize : null,
                        totalSubgroups: subgroupInfo ? subgroupInfo.totalSubgroups : 0
                    };
                }
            }
            // Does not belong to any cluster (single)
            const qtm = calculateQTM(allMoves[idx]);
            const htm = calculateHTM(allMoves[idx]);
            return {
                school: "None",
                label: "Unlabeled",
                prefix: "",
                schoolRank: null,
                score: 0,
                qtm: qtm,
                htm: htm,
                originalIdx: idx,
                recommendationRank: null,
                totalCandidates: labeledIndices.length,
                subgroupIndex: null,
                subgroupSize: null,
                totalSubgroups: 0
            };
        }
        const labeledItem = labeledIndices.find(item => item.idx === idx);
        const qtm = calculateQTM(allMoves[idx]);
        const htm = calculateHTM(allMoves[idx]);
        
        // Get subgroup information from the map (for labeled items too)
        const subgroupInfo = subgroupInfoMap.get(idx);
        
        return {
            ...label,
            qtm: qtm,
            htm: htm,
            originalIdx: idx,
            recommendationRank: rankMap.get(idx),
            adjustedScore: labeledItem ? labeledItem.adjustedScore : null,
            totalCandidates: labeledIndices.length,
            subgroupIndex: subgroupInfo ? subgroupInfo.subgroupIndex : null,
            subgroupSize: subgroupInfo ? subgroupInfo.subgroupSize : null,
            totalSubgroups: subgroupInfo ? subgroupInfo.totalSubgroups : 0
        };
    });

    return result;
}

/**
 * Original implementation (for comparison)
 */

// ============================================================================
// Module Exports (for Node.js)
// ============================================================================

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        getFinalLabelList,
        computeAdvancedEditDistance,
        stringToAlg,
        calculateQTM,
        MOVE_NAMES
    };
}

// ============================================================================
// Web Worker Interface (for Browser)
// ============================================================================

if (typeof self !== "undefined" && typeof importScripts === "function") {
    /**
     * Web Worker message handler
     * 
     * Input data format:
     * {
     *   solutions: string[],           // List of solution strings (e.g., ["R U R' U'", "F R U' R'", ...])
     *   threshold: number,             // Clustering threshold (default: 4)
     *   prefixLen: number              // Prefix length (default: 4)
     * }
     * 
     * Output data format:
     * {
     *   results: Array<{               // Complete results corresponding to each solution
     *     school: string,
     *     label: string,
     *     recommendationRank: number | null,
     *     score: number,
     *     adjustedScore: number,
     *     qtm: number,
     *     prefix: string,
     *     schoolRank: number,
     *     totalCandidates: number
     *   }>,
     *   stats: {                       // Statistics information
     *     total: number,
     *     labeled: number,
     *     unlabeled: number,
     *     representative: number,
     *     alternative: number,
     *     member: number,
     *     schools: number,
     *     score100: number
     *   }
     * }
     */
    self.onmessage = function(event) {
        try {
            const { solutions, config = {} } = event.data;
            
            // Input validation
            if (!Array.isArray(solutions)) {
                throw new Error("solutions must be an array");
            }
            
            if (solutions.length === 0) {
                self.postMessage({
                    results: [],
                    stats: {
                        total: 0,
                        labeled: 0,
                        unlabeled: 0,
                        representative: 0,
                        alternative: 0,
                        member: 0,
                        schools: 0,
                        score100: 0
                    }
                });
                return;
            }
            
            // Execute labeling process (passing config)
            const fullResults = getFinalLabelList(solutions, config);
            
            // Calculate statistics
            let labeled = 0;
            let unlabeled = 0;
            let representative = 0;
            let alternative = 0;
            let member = 0;
            let score100 = 0;
            const schoolSet = new Set();
            
            fullResults.forEach(result => {
                if (result.label === 'Unlabeled') {
                    unlabeled++;
                } else {
                    labeled++;
                    if (result.school && result.school !== 'None') {
                        schoolSet.add(result.school);
                    }
                    if (result.label === 'Representative') {
                        representative++;
                    } else if (result.label.includes('Alternative')) {
                        alternative++;
                    } else if (result.label === 'Member') {
                        member++;
                    }
                }
                
                // Count scores of 100
                if (result.score >= 100) {
                    score100++;
                }
            });
            
            // Send results (complete information)
            self.postMessage({
                results: fullResults,
                stats: {
                    total: solutions.length,
                    labeled: labeled,
                    unlabeled: unlabeled,
                    representative: representative,
                    alternative: alternative,
                    member: member,
                    schools: schoolSet.size,
                    score100: score100
                }
            });
            
        } catch (error) {
            // Send error
            self.postMessage({
                error: error.message || "Unknown error occurred",
                results: null,
                stats: null
            });
        }
    };
}
