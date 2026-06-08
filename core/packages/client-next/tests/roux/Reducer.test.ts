import { it, expect } from 'vitest';
import { CubieCube, Move, FaceletCube } from '@/lib/roux/CubeLib';
import { CubeUtil } from "@/lib/roux/CubeLib"
import min2phase from "@/lib/roux/min2phase"


it('calls cstimer correctly', () => {

  console.debug("tf")
  const cube = new CubieCube().apply("R U B")

  console.log("tf")
  const transformed_cube = cube.to_cstimer_cube()

  console.assert( transformed_cube.is_solveable(), "Cube must be solveable")

  min2phase.initialize();

   min2phase.solve(transformed_cube)
  //Cube.initSolver();
  //ReactDOM.render(<App />, div);
  //ReactDOM.unmountComponentAtNode(div);
});
