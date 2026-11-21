//! Fix the center frame while carrying its rigid basis into each fitted pose.
//! This is an exact change of coordinates, before any color-checked removal.
use super::*;

pub(super) fn normalize(t: &Tables, steps: &[Value]) -> Result<Vec<Value>, String> {
    let orientations = super::super::orientations::tables();
    let identity: Vec<_> = (0..54).collect();
    let centers: Vec<_> = (0..54)
        .filter(|&p| {
            ["R", "L", "U", "D", "F", "B"]
                .iter()
                .all(|m| t.moves[*m][p] == p)
        })
        .collect();
    let rotations: Vec<Vec<usize>> = orientations
        .face_permutations
        .iter()
        .map(|faces| {
            let mut sources = vec![0; 54];
            for (source, &target) in faces.iter().enumerate() {
                sources[t.geometry_positions[target]] = t.geometry_positions[source];
            }
            sources
        })
        .collect();
    let names: Vec<_> = ["R", "L", "U", "D", "F", "B"]
        .iter()
        .flat_map(|n| [n.to_string(), format!("{n}'"), format!("{n}2")])
        .collect();
    let mut words = HashMap::from([(identity, vec![])]);
    for name in &names {
        words
            .entry(t.moves[name].clone())
            .or_insert(vec![name.clone()]);
    }
    for a in &names {
        for b in &names {
            let sources: Vec<_> = t.moves[b].iter().map(|&i| t.moves[a][i]).collect();
            words.entry(sources).or_insert(vec![a.clone(), b.clone()]);
        }
    }
    let mut raw = t.identity.clone();
    let mut previous = t.identity.clone();
    let mut result = vec![];
    for step in steps {
        let mut step = step.clone();
        let mut moves = vec![];
        for token in step["state_moves"]
            .as_array()
            .ok_or("Solution step has no moves")?
        {
            raw = apply(t, &raw, token.as_str().ok_or("Invalid solution move")?)?;
            let rotation = rotations
                .iter()
                .find(|rotation| centers.iter().all(|&p| raw[rotation[p]] == t.identity[p]))
                .ok_or("Solution has an invalid center frame")?;
            let current: Vec<_> = rotation.iter().map(|&i| raw[i]).collect();
            let mut inverse = vec![0; 54];
            for (i, &label) in previous.iter().enumerate() {
                inverse[label as usize] = i;
            }
            let sources: Vec<_> = current
                .iter()
                .map(|&label| inverse[label as usize])
                .collect();
            moves.extend(
                words
                    .get(&sources)
                    .ok_or("Cannot express centered move using outer turns")?
                    .clone(),
            );
            previous = current;
        }
        let rotation = rotations
            .iter()
            .position(|rotation| centers.iter().all(|&p| raw[rotation[p]] == t.identity[p]))
            .ok_or("Solution has an invalid center frame")?;
        let old = step["orientation_symmetry_index"]
            .as_u64()
            .map(|s| s as usize)
            .unwrap_or(orientations.identity_index);
        let faces: Vec<_> = orientations
            .face_permutations
            .get(old)
            .ok_or("Invalid solution orientation")?
            .iter()
            .map(|&face| orientations.face_permutations[rotation][face])
            .collect();
        let symmetry = orientations
            .face_permutations
            .iter()
            .position(|p| *p == faces)
            .unwrap();
        step["state_moves"] = json!(moves);
        if symmetry == orientations.identity_index {
            step.as_object_mut()
                .unwrap()
                .remove("orientation_symmetry_index");
        } else {
            step["orientation_symmetry_index"] = json!(symmetry);
        }
        result.push(step);
    }
    Ok(result)
}
