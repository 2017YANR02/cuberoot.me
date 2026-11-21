use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashMap;
use std::sync::Arc;

type SharedPermutation = (Arc<Vec<usize>>, Arc<Vec<String>>);

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct Group {
    pub axis: usize,
    pub offsets: [i32; 3],
}
#[derive(Deserialize)]
pub struct GroupSpec {
    #[serde(flatten)]
    pub group: Group,
    pub moves: Vec<String>,
    pub sources: Vec<usize>,
}
#[derive(Deserialize)]
pub struct Tables {
    pub identity: Vec<u8>,
    pub geometry_positions: Vec<usize>,
    pub face_groups: Vec<Vec<usize>>,
    pub solved_colors: Vec<String>,
    pub groups: Vec<GroupSpec>,
    pub moves: HashMap<String, Vec<usize>>,
    pub confusion: HashMap<String, Vec<String>>,
    pub keypoint_scale: f64,
    pub sticker_scale: f64,
    #[serde(skip)]
    permutations: RefCell<HashMap<Vec<Group>, SharedPermutation>>,
    #[serde(skip)]
    pub material_cache:super::motion::MaterialCache,
}
impl Tables {
    pub fn load() -> Self {
        serde_json::from_str(include_str!("../../tables/move-tables.json")).unwrap()
    }
    pub fn colors(&self, scramble: &str) -> Result<Vec<String>, String> {
        let mut colors: Vec<_> = self
            .identity
            .iter()
            .map(|&i| self.solved_colors[i as usize].clone())
            .collect();
        let normalized = scramble.replace('’', "'");
        for token in normalized.split_whitespace() {
            let token = token.trim_end_matches("2'").to_string()
                + if token.ends_with("2'") { "2" } else { "" };
            let sources = self
                .moves
                .get(&token)
                .ok_or_else(|| format!("Unknown scramble move: {token}"))?;
            colors = sources.iter().map(|&i| colors[i].clone()).collect();
        }
        // Colors are keyed by encoded identity label, not by position.
        let mut result = vec![String::new(); 54];
        for (position, &label) in self.identity.iter().enumerate() {
            result[label as usize] = colors[position].clone();
        }
        Ok(result)
    }
    pub fn permutation(&self, groups: &[Group]) -> (Vec<usize>, Vec<String>) {
        let (sources, moves) = self.shared_permutation(groups);
        (sources.as_ref().clone(), moves.as_ref().clone())
    }
    /// Frame/camera alternatives use the same immutable sticker permutation.
    /// Retain one copy in the table cache instead of cloning it into every row.
    pub fn shared_permutation(&self, groups: &[Group]) -> SharedPermutation {
        if let Some(value) = self.permutations.borrow().get(groups) {
            return value.clone();
        }
        let mut sources: Vec<_> = (0..54).collect();
        let mut moves = vec![];
        for group in groups {
            let spec = self.groups.iter().find(|g| g.group == *group).unwrap();
            sources = spec.sources.iter().map(|&i| sources[i]).collect();
            moves.extend(spec.moves.clone());
        }
        let value = (Arc::new(sources), Arc::new(moves));
        self.permutations.borrow_mut().insert(groups.to_vec(), value.clone());
        value
    }
    pub fn solved(&self, state: &[u8], colors: &[String]) -> bool {
        let first: Vec<_> = self
            .face_groups
            .iter()
            .map(|g| &colors[state[g[0]] as usize])
            .collect();
        self.face_groups
            .iter()
            .zip(&first)
            .all(|(g, c)| g.iter().all(|&p| &colors[state[p] as usize] == *c))
            && (0..6).all(|i| (0..i).all(|j| first[i] != first[j]))
    }
    /// Scramble inversion followed by all 24 rigid orientations. No observed
    /// move sequence or fitted pose is used to construct the solved boundary.
    pub fn solved_seeds(&self, scramble: &str) -> Result<Vec<Vec<u8>>, String> {
        let normalized = scramble.replace('’', "'");
        let mut state = self.identity.clone();
        for token in normalized.split_whitespace().rev() {
            let inverse = if token.ends_with('2') || token.ends_with("2'") {
                token.trim_end_matches('\'').to_string()
            } else if token.ends_with('\'') {
                token.trim_end_matches('\'').to_string()
            } else {
                format!("{token}'")
            };
            let sources = self.moves.get(&inverse).ok_or_else(|| format!("Unknown scramble move: {token}"))?;
            state = sources.iter().map(|&i| state[i]).collect();
        }
        let mut states = vec![state];
        let mut seen = std::collections::HashSet::from([states[0].clone()]);
        let mut index = 0;
        while index < states.len() {
            for name in ["x", "y", "z"] {
                let next: Vec<_> = self.moves[name].iter().map(|&i| states[index][i]).collect();
                if seen.insert(next.clone()) { states.push(next); }
            }
            index += 1;
        }
        Ok(states)
    }
}
pub fn normalize(groups: &[Group]) -> Vec<Group> {
    let mut result: Vec<Group> = vec![];
    for group in groups {
        let mut q = group.offsets;
        if result.last().is_some_and(|p| p.axis == group.axis) {
            let previous = result.pop().unwrap();
            for i in 0..3 {
                q[i] += previous.offsets[i];
            }
        }
        for v in &mut q {
            *v = v.rem_euclid(4);
            if *v > 2 {
                *v -= 4;
            }
        }
        if q != [0; 3] {
            result.push(Group {
                axis: group.axis,
                offsets: q,
            });
        }
    }
    result
}

#[cfg(test)]
mod sharing_tests {
    use super::*;

    #[test]
    fn cached_permutations_share_immutable_storage_and_keep_owned_exports_independent() {
        let tables = Tables::load();
        let groups = vec![Group { axis: 0, offsets: [0, 0, 1] }];
        let first = tables.shared_permutation(&groups);
        let second = tables.shared_permutation(&groups);
        assert!(Arc::ptr_eq(&first.0, &second.0));
        assert!(Arc::ptr_eq(&first.1, &second.1));
        let mut owned = tables.permutation(&groups);
        assert_eq!(owned.0, *first.0);
        assert_eq!(owned.1, *first.1);
        owned.0[0] = 999;
        owned.1.clear();
        assert_ne!(owned.0, *first.0);
        assert!(!first.1.is_empty());
        assert_eq!(serde_json::to_value(&first).unwrap(), serde_json::to_value(tables.permutation(&groups)).unwrap());
    }
}
