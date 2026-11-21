//! Incremental forward and post-fitting bidirectional move search. Numerical
//! preparation and search state are independent of the decoder and UI.
pub mod cube;
mod bidirectional;
mod frontier;
pub mod motion;
mod motion_history;
pub mod orientations;
mod prepared;
mod postprocess;
pub mod reliability;
pub mod routes;
use crate::Fit;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
/// Geometry-equivalent keys for communication only. Search frontiers retain
/// their own original states, cues, dominance keys, and queue ordering.
fn meeting_context(t:&cube::Tables,frames:&[prepared::Prepared],depth:usize,state:&[u8],cue:Option<usize>)->(Vec<u8>,Option<usize>){
    let mut canonical=state.to_vec();
    if let Some(g)=frames[..depth.min(frames.len())].iter().rev().find(|p|!p.held)
        .filter(|p|p.resolve_orientation).and_then(|p|cue.and_then(|cue|p.geometry(cue))){
        let perm=&orientations::tables().face_permutations[g.symmetry];
        for face in 0..54 {canonical[t.geometry_positions[face]]=state[t.geometry_positions[perm[face]]];}
        (canonical,Some(g.bank_index))
    }else{(canonical,cue)}
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Config {
    pub scramble: String,
    pub fps: f64,
    pub max_tps: f64,
    pub max_slice_tps: Option<f64>,
    pub turning_start_frame: Option<usize>,
    pub branch_widths: Vec<usize>,
    pub branch_stage_expansions: usize,
    pub state_limit: usize,
    pub mismatch_window_weight: f64,
    pub motion_cost_weight: f64,
    pub unrestricted_sticker_count: Option<usize>,
    pub pause_at_live_frontier: bool,
    pub expand_flagged_frames: bool,
    pub resolve_orientation_ambiguity: bool,
    pub max_rotation_tps: Option<f64>,
    pub preserve_hold: bool,
    /// Retain optional per-step telemetry. Scoring and essential path data are unchanged.
    pub diagnostics: bool,
    /// Wait for input closure, then search from both the scramble and a solved
    /// end-frame anchor. Legacy callers retain streaming forward exploration.
    pub bidirectional: bool,
    pub postprocess_identity_loops: bool,
    pub postprocess_color_tolerance: f64,
    pub postprocess_pose_cleanup: bool,
}
impl Default for Config {
    fn default() -> Self {
        Self {
            scramble: String::new(),
            fps: 30.,
            max_tps: 40.,
            max_slice_tps: None,
            turning_start_frame: None,
            branch_widths: vec![3],
            branch_stage_expansions: 10000,
            state_limit: 1_000_000,
            mismatch_window_weight: 1.,
            motion_cost_weight: 0.,
            unrestricted_sticker_count: Some(3),
            pause_at_live_frontier: true,
            expand_flagged_frames: false,
            resolve_orientation_ambiguity: false,
            max_rotation_tps: None,
            preserve_hold: false,
            diagnostics: true,
            bidirectional: false,
            postprocess_identity_loops: false,
            postprocess_color_tolerance: 0.02,
            postprocess_pose_cleanup: false,
        }
    }
}
#[derive(Deserialize, Clone, Default)]
pub struct Frame {
    pub sequence: usize,
    pub frame: usize,
    pub bank: Vec<Fit>,
    pub colors: Vec<String>,
    #[serde(default)]
    pub landmark_count: Option<usize>,
    #[serde(default)]
    pub flagged: Option<bool>,
    #[serde(default)]
    pub geometry_flagged: Option<bool>,
}
pub struct Engine {
    tables: cube::Tables,
    config: Config,
    pending: BTreeMap<usize, prepared::Prepared>,
    frames: Vec<prepared::Prepared>,
    frontier: frontier::Frontier,
    last_active: Option<usize>,
    baseline: Option<i64>,
    ended: bool,
    bidirectional: Option<bidirectional::Bidirectional>,
    bidirectional_fallback: bool,
    external_result: Option<serde_json::Value>,
    external_side_used: bool,
    postprocessed_result: Option<serde_json::Value>,
}
impl Engine {
    pub fn new(config: Config) -> Result<Self, String> {
        if !config.fps.is_finite()
            || config.fps <= 0.
            || !config.max_tps.is_finite()
            || config.max_tps <= 0.
            || config.max_slice_tps.is_some_and(|v| !v.is_finite() || v <= 0. || v > config.max_tps)
            || config.branch_widths.is_empty()
            || config.branch_widths.iter().any(|&v| v == 0)
            || config.branch_widths.windows(2).any(|p| p[0] >= p[1])
            || config.branch_stage_expansions == 0
            || config.state_limit == 0
            || !config.mismatch_window_weight.is_finite()
            || config.mismatch_window_weight < 0.
            || !config.motion_cost_weight.is_finite()
            || config.motion_cost_weight < 0.
            || !config.postprocess_color_tolerance.is_finite()
            || !(0.0..=1.0).contains(&config.postprocess_color_tolerance)
            || config
                .max_rotation_tps
                .is_some_and(|v| !v.is_finite() || v <= 0. || v >= config.max_tps)
        {
            return Err("Move search requires positive finite FPS and TPS, ordered branch widths, finite weights, and rotation TPS below move TPS".into());
        }
        let tables = cube::Tables::load();
        let frontier = frontier::Frontier::new(&tables, &config)?;
        Ok(Self {
            tables,
            config,
            pending: BTreeMap::new(),
            frames: vec![],
            frontier,
            last_active: None,
            baseline: None,
            ended: false,
            bidirectional: None,
            bidirectional_fallback: false,
            external_result: None,
            external_side_used: false,
            postprocessed_result: None,
        })
    }
    pub fn push(&mut self, input: Frame) -> Result<(), String> {
        if self.ended {
            return Err("Move search input is closed".into());
        }
        let sequence = input.sequence;
        if sequence < self.frames.len() || self.pending.contains_key(&sequence) {
            return Err("Duplicate move-search frame sequence".into());
        }
        let prepared = prepared::compile(&self.tables, &self.config, input)?;
        self.pending.insert(sequence, prepared);
        while let Some(mut p) = self.pending.remove(&self.frames.len()) {
            if self.frames.last().is_some_and(|old| p.frame <= old.frame) {
                return Err("Move-search source frames must increase".into());
            }
            self.baseline.get_or_insert(p.frame as i64 - 1);
            // Opening frames without a pose carry no motion evidence. Skip
            // them rather than accumulating hidden turns before the first
            // usable pose (which can make its transition enumeration explode).
            // Once a usable pose exists, missing-pose gaps keep their elapsed
            // motion allowance and their existing search semantics.
            if self.last_active.is_none() && p.held && p.geometries.is_empty() {
                self.baseline = Some(p.frame as i64);
            }
            if self
                .config
                .turning_start_frame
                .is_some_and(|end| p.frame <= end)
            {
                self.last_active = None;
                self.baseline = Some(p.frame as i64);
                self.frontier.add_static();
            }
            if !p.held {
                p.previous = self.last_active;
                let previous = self
                    .last_active
                    .map(|i| self.frames[i].frame as i64)
                    .unwrap_or(self.baseline.unwrap());
                p.limit = 90. * self.config.max_tps * (p.frame as f64 - previous as f64)
                    / self.config.fps;
                p.slice_limit = p.limit * self.config.max_slice_tps.unwrap_or(self.config.max_tps) / self.config.max_tps;
                p.rotation_limit = self
                    .config
                    .max_rotation_tps
                    .map(|rate| p.limit * rate / self.config.max_tps);
                self.last_active = Some(self.frames.len());
            }
            // The fitted tail is still recorded after a solution is committed,
            // but it cannot change that solution. Do not enumerate hidden turns
            // across long gaps after the cube has left the camera.
            if self.frontier.winner.is_some() {
                p.ready = true;
            }
            self.frames.push(p);
        }
        prepared::release(&self.tables, &mut self.frames);
        self.frontier.unblock(&self.tables, &self.frames, false);
        Ok(())
    }
    pub fn end(&mut self) -> Result<(), String> {
        if !self.pending.is_empty() {
            return Err("Cannot close move search with a missing earlier frame".into());
        }
        if self.ended { return Ok(()); }
        self.ended = true;
        self.frontier.unblock(&self.tables, &self.frames, true);
        if self.config.bidirectional && self.frontier.winner.is_none() {
            self.bidirectional = bidirectional::Bidirectional::new(&self.tables, &self.config, &self.frames);
            self.bidirectional_fallback = self.bidirectional.is_none();
            self.frontier.observe_meeting_events();
        }
        Ok(())
    }
    pub fn advance(&mut self, budget: usize) {
        if self.external_result.is_some() { return; }
        if self.config.bidirectional && !self.ended { return; }
        if let Some(search) = &mut self.bidirectional {
            search.run(&mut self.frontier, &self.tables, &self.config, &self.frames, budget.min(128));
            self.finish_solution();
            return;
        }
        self.frontier.run(
            &self.tables,
            &self.config,
            &self.frames,
            self.ended,
            budget.min(100_000),
        );
        self.finish_solution();
    }
    pub fn snapshot(&self) -> serde_json::Value {
        let mut result=self.raw_snapshot();
        self.apply_postprocess(&mut result);
        result
    }
    fn apply_postprocess(&self,result:&mut serde_json::Value) {
        if let Some(cleaned)=&self.postprocessed_result {
            for key in ["steps","postprocess","unprocessed_steps"] {
                if let Some(value)=cleaned.get(key){result[key]=value.clone();}
            }
        }
    }
    fn raw_snapshot(&self) -> serde_json::Value {
        if let Some(result)=&self.external_result {return result.clone();}
        if let Some(search) = &self.bidirectional {
            let mut result=search.snapshot(&self.frontier,&self.frames);
            if self.external_side_used {result["parallel"]=true.into();}
            return result;
        }
        let mut result = self.frontier.snapshot(&self.frames, self.pending.len(), self.ended);
        if self.config.bidirectional {
            result["search_direction"] = if self.ended { "forward" } else { "bidirectional" }.into();
            if self.bidirectional_fallback {
                result["bidirectional_fallback"] = "No corroborated flat solved end frame".into();
            }
        }
        result
    }
    pub fn postprocess_result(&self,result:serde_json::Value)->Result<serde_json::Value,String>{
        postprocess::clean(&self.tables,&self.config,&self.frames,result)
    }
    fn finish_solution(&mut self) {
        if !self.config.postprocess_identity_loops || self.postprocessed_result.is_some() {return;}
        if self.frontier.winner.is_none() && !self.bidirectional.as_ref().is_some_and(|b|b.has_winner())
            && self.external_result.is_none() {return;}
        let raw=self.raw_snapshot();
        if raw["status"]!="solved" {return;}
        self.postprocessed_result=Some(match self.postprocess_result(raw.clone()) {
            Ok(cleaned)=>cleaned,
            Err(error)=>{let mut raw=raw;raw["postprocess"]=serde_json::json!({"enabled":true,"error":error,"removed_moves":0,"removed_sections":0});raw},
        });
    }
    /// Independent directional work for two native threads or browser workers.
    /// Direction zero invokes the original forward frontier without a wrapper
    /// changing its candidate admission, dominance, or queue order.
    pub fn advance_side(&mut self, direction: usize, budget: usize) -> Result<serde_json::Value,String> {
        if !self.ended || !self.config.bidirectional {return Err("Directional search requires completed bidirectional input".into());}
        self.external_side_used=true;
        let mut result;
        let meetings:Vec<_>=match direction {
            0=>{
                self.frontier.run(&self.tables,&self.config,&self.frames,true,budget.min(128));
                result=self.frontier.snapshot(&self.frames,0,true);
                self.frontier.take_meeting_events().into_iter().map(|id|{
                    let(depth,state,cue)=self.frontier.node_context(id).unwrap();
                    let(state,cue)=meeting_context(&self.tables,&self.frames,depth,state,cue);
                    serde_json::json!([id,depth,cue,state])
                }).collect()
            },
            1=>{
                let search=self.bidirectional.as_mut().ok_or("No solved end-frame anchor")?;
                search.run_backward(&self.tables,&self.config,&self.frames,budget.min(128));
                result=search.backward_snapshot(&self.frames);
                search.take_events().into_iter().map(|id|{
                    let(depth,state,cue)=search.node(id).unwrap();
                    let(state,cue)=meeting_context(&self.tables,&self.frames,depth,state,cue);
                    serde_json::json!([id,depth,cue,state])
                }).collect()
            },
            _=>return Err("Search direction must be zero or one".into()),
        };
        if direction==0 && self.config.postprocess_identity_loops && result["status"]=="solved" {
            self.finish_solution();self.apply_postprocess(&mut result);
        }
        result["meeting_states"]=meetings.into();
        Ok(result)
    }
    pub fn node_path(&self,direction:usize,id:usize)->Result<serde_json::Value,String>{
        if direction==1 {return self.bidirectional.as_ref().ok_or("No solved end-frame anchor")?.fragment(id).ok_or("Unknown search node".into());}
        let (path,context)=match direction {
            0=>(self.frontier.node_path(id),self.frontier.node_context(id)),
            1=>{let search=self.bidirectional.as_ref().ok_or("No solved end-frame anchor")?;(search.node_path(id),search.node(id))},
            _=>return Err("Search direction must be zero or one".into()),
        };
        let (depth,state,cue)=context.ok_or("Unknown search node")?;
        Ok(serde_json::json!({"steps":path.ok_or("Unknown search node")?,"depth":depth,"state":state,"cue":cue}))
    }
    /// Validate a remote backward fragment with this engine's forward probes
    /// before publishing a joined result. Messages carry no trusted move oracle.
    pub fn complete_join(&mut self,forward_node:usize,backward_steps:Vec<serde_json::Value>,backward_state:Option<Vec<u8>>,stats:serde_json::Value)->Result<serde_json::Value,String>{
        if !self.ended || !self.config.bidirectional {return Err("Joining requires completed bidirectional input".into());}
        let (depth,initial,cue)=self.frontier.node_context(forward_node).ok_or("Unknown forward node")?;
        let mut state=initial.to_vec();let mut cue=cue;
        let sources=if let Some(backward)=backward_state {
            if backward.len()!=54{return Err("Invalid backward meeting state".into());}
            orientations::tables().face_permutations.iter().find_map(|perm|{
                let mut sources:Vec<_>=(0..54).collect();
                for face in 0..54 {sources[self.tables.geometry_positions[face]]=self.tables.geometry_positions[perm[face]];}
                sources.iter().map(|&i|backward[i]).eq(state.iter().copied()).then_some(sources)
            }).ok_or("Meeting states are not equivalent cube orientations")?
        }else{(0..54).collect()};
        let null=serde_json::Value::Null;
        let mut suffix=vec![];
        for (offset,step) in backward_steps.iter().enumerate(){
            let p=self.frames.get(depth+offset).ok_or("Joined path exceeds fitted input")?;
            if step["frame_index"].as_u64()!=Some(p.frame as u64){return Err("Joined frame sequence is discontinuous".into());}
            let choices=self.frontier.probe(&self.tables,p,&state,cue);
            let target=step.get("state_after").and_then(|v|v.as_array()).map(|values|values.iter().map(|v|v.as_u64().map(|n|n as u8)).collect::<Option<Vec<_>>>()).flatten();
            if target.as_ref().is_some_and(|target|target.len()!=54){return Err("Invalid backward successor state".into());}
            let expected=target.as_ref().map(|target|sources.iter().map(|&i|target[i]).collect::<Vec<_>>());
            let remote_cue=step.get("cue_after").and_then(|v|v.as_u64()).map(|n|n as usize);
            let mut selected=choices.iter().find(|choice|{
                if let (Some(target),Some(expected))=(&target,&expected) {
                    let mut after=state.clone();
                    for name in &choice.state_moves {after=self.tables.moves[name].iter().map(|&i|after[i]).collect();}
                    if after!=*expected {return false;}
                    let after_cue=choice.geometry_option_index.map(|bank|choice.orientation_symmetry_index.map_or(bank,|symmetry|6+24*bank+symmetry as usize));
                    meeting_context(&self.tables,&self.frames,depth+offset+1,&after,after_cue)==meeting_context(&self.tables,&self.frames,depth+offset+1,target,remote_cue)
                }else{
                    let value=serde_json::to_value(choice).unwrap();
                    ["state_moves","geometry_option_index","orientation_symmetry_index"].iter().all(|key|value.get(*key).unwrap_or(&null)==step.get(*key).unwrap_or(&null))
                }
            }).cloned();
            if p.held {
                if step["state_moves"].as_array().is_none_or(|moves|!moves.is_empty()){return Err("A held frame must preserve the cube state".into());}
                suffix.push(step.clone());
                continue;
            }
            // A change of cube coordinates can put the rebased edge outside
            // the forward scorer's orientation shortlist. Validate against the
            // same mechanical rows directly; do not change that shortlist or
            // admit anything into the running forward frontier.
            if selected.is_none() && p.resolve_orientation {
                if let (Some(target),Some(expected))=(&target,&expected){
                    let canonical=meeting_context(&self.tables,&self.frames,depth+offset+1,target,remote_cue);
                    let color_ids:Vec<_>=self.frontier.colors.iter().map(|name|prepared::COLORS.iter().position(|c|c==name).unwrap()).collect();
                    for g in &p.geometries {
                        if meeting_context(&self.tables,&self.frames,depth+offset+1,expected,Some(g.index))!=canonical {continue;}
                        let rows=prepared::orientation_rows(&self.tables,p,cue,g.index);
                        for &index in &rows.scoring_indices {
                            let row=&rows.rows[index];
                            if row.sources.iter().map(|&i|state[i]).eq(expected.iter().copied()) {
                                selected=frontier::reverse_step(&self.tables,p,row,expected,&color_ids);break;
                            }
                        }
                        if selected.is_some(){break;}
                    }
                }
            }
            let selected=selected.as_ref().ok_or(if expected.is_some(){"Incompatible meeting basis"}else{"Remote fragment contains an illegal forward transition"})?;
            for name in &selected.state_moves {state=self.tables.moves[name].iter().map(|&i|state[i]).collect();}
            cue=selected.geometry_option_index.map(|bank|selected.orientation_symmetry_index.map_or(bank,|symmetry|6+24*bank+symmetry as usize));
            let mut rendered=serde_json::to_value(frontier::SavedStep::new(selected.clone(),self.config.diagnostics)).unwrap();
            for field in ["queue_priority","sibling_rank","window_mismatch_rate","window_mismatch_penalty","recent_motion_penalty","required_tps_ratio"] {
                if let Some(value)=step.get(field){rendered[field]=value.clone();}
            }
            suffix.push(rendered);
        }
        if !self.tables.solved(&state,&self.frontier.colors){return Err("Joined path does not solve the cube".into());}
        let mut steps=serde_json::to_value(self.frontier.node_path(forward_node).unwrap()).unwrap().as_array().unwrap().clone();
        steps.extend(suffix);
        let mut result=self.frontier.snapshot(&self.frames,0,true);
        result["status"]="solved".into();result["search_direction"]="bidirectional".into();result["parallel"]=true.into();
        result["solved_frame_index"]=steps.last().map(|step|step["frame_index"].clone()).unwrap_or(null);
        result["furthest_admitted_frames"]=steps.len().into();result["steps"]=steps.into();result["stats"]=stats;
        result["join_frame_index"]=depth.checked_sub(1).map(|i|self.frames[i].frame).into();
        if let Some(search)=&self.bidirectional {result["solved_anchor_frame"]=search.anchor_frame(&self.frames).into();}
        self.postprocessed_result=None;
        self.external_result=Some(result);
        self.finish_solution();Ok(self.snapshot())
    }
    pub fn probe(
        &self,
        sequence: usize,
        state: Vec<u8>,
        cue: Option<usize>,
    ) -> Result<serde_json::Value, String> {
        if state.len() != 54 || state.iter().any(|&v| v >= 54) {
            return Err("Search state must have 54 encoded identities".into());
        }
        let p = self.frames.get(sequence).ok_or("Frame is not ready")?;
        Ok(
            serde_json::json!({"rows":p.rows,"choices":self.frontier.probe(&self.tables,p,&state,cue)}),
        )
    }
}
#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Request {
    Init {
        config: Config,
    },
    Frame {
        frame: Frame,
    },
    Advance {
        budget: usize,
    },
    AdvanceSide { direction:usize, budget:usize },
    Path { direction:usize, node:usize },
    CompleteJoin { forward_node:usize, backward_steps:Vec<serde_json::Value>, backward_state:Option<Vec<u8>>, stats:serde_json::Value },
    Postprocess { result:serde_json::Value },
    End,
    Status,
    Probe {
        sequence: usize,
        state: Vec<u8>,
        cue: Option<usize>,
    },
}
pub fn request(slot: &mut Option<Engine>, request: Request) -> Result<serde_json::Value, String> {
    if let Request::Init { config } = request {
        *slot = Some(Engine::new(config)?);
        return Ok(slot.as_ref().unwrap().snapshot());
    }
    let engine = slot
        .as_mut()
        .ok_or("Move search has not been initialized")?;
    match request {
        Request::Frame { frame } => engine.push(frame)?,
        Request::Advance { budget } => engine.advance(budget),
        Request::AdvanceSide {direction,budget}=>return engine.advance_side(direction,budget),
        Request::Path {direction,node}=>return engine.node_path(direction,node),
        Request::CompleteJoin {forward_node,backward_steps,backward_state,stats}=>return engine.complete_join(forward_node,backward_steps,backward_state,stats),
        Request::Postprocess {result}=>return engine.postprocess_result(result),
        Request::End => engine.end()?,
        Request::Probe {
            sequence,
            state,
            cue,
        } => return engine.probe(sequence, state, cue),
        _ => {}
    }
    Ok(engine.snapshot())
}
#[cfg(test)]
mod tests;
