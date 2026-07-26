/*
 OptClock - Optimal clock solver.
 Copyright (C) 2014 Michael Gottlieb

 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU General Public License
 as published by the Free Software Foundation; either version 2
 of the License, or (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program; if not, write to the Free Software
 Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
*/

// Main struct and control flow of program, with all includes used in it

#include <random>
#include <fstream>
#include <iostream>
#include <string>
#include <time.h>
#include <windows.h>

struct optClock {
	// Pack array into int
	static int pack6(unsigned char position[]) {
		return 248832*position[0] + 20736*position[1] + 1728*position[2] +
			144*position[3] + 12*position[4] + position[5];
	}
	static int pack4(unsigned char position[]) {
		return 1728*position[0] + 144*position[1] + 12*position[2] + position[3];
	}

	// Unpack int into array
	static unsigned char* unpack6(int index) {
		unsigned char *position = new unsigned char[6];
		for (int i=5; i>=0; i--) {
			position[i] = index % 12;
			index = index / 12;
		}
		return position;
	}
	static unsigned char* unpack4(int index) {
		unsigned char *position = new unsigned char[4];
		for (int i=3; i>=0; i--) {
			position[i] = index % 12;
			index = index / 12;
		}
		return position;
	}

	// Return position tmp1 + move * amt (for phase 2)
	static unsigned char* applyMove6(unsigned char position[], unsigned char move[], int amt) {
		unsigned char *newPosition = new unsigned char[6];
		for (int i=0; i<6; i++) {
			newPosition[i] = (position[i] + (move[i] * amt)) % 12;
		}
		return newPosition;
	}

	static unsigned char* loadPhase2Table(unsigned char *phase2Moves)
	{
		unsigned char *table = new unsigned char[2985984];
		
		// file code mostly from ksolve
		std::string filename = "phase2.table";
		std::ifstream fin;
		fin.open(filename.c_str(), std::ios::in | std::ios::binary);
		bool tablesExist = fin.is_open(); // do tables exist?
		
		if (tablesExist) {
			std::cout << "Phase 2 pruning tables found on file.\n";
			
			// read table from file
			for (int i=0; i<2985984; i++) {
				if (!fin.good()) {
					std::cerr << "Something wrong with file phase2.table!\n";
					exit(0);
					break;
				}
				table[i] = (unsigned char) fin.get();
			}
			
			fin.close();
		} else {
			std::cout << "Generating phase 2 pruning tables.\n";
			
			// generate table
			for (int i=1; i<2985984; i++) {
				table[i] = 255;
			}
			table[0] = 0;
			int depth = 0;
			int cnt[10] = {1, 0, 0, 0, 0, 0, 0, 0, 0, 0};
			while (1 == 1) {
				// look for positions at this depth
				for (int i=0; i<2985984; i++) {
					if (table[i] == depth) {
						unsigned char* temp1 = unpack6(i);
						for (int move=0; move<14; move++) {
							for (int amt=1; amt<12; amt++) {
								unsigned char* temp2 = applyMove6(temp1, &(phase2Moves[move*6]), amt);
								int packed = pack6(temp2);
								if (table[packed] == 255) {
									cnt[depth+1] += 1;
									table[packed] = depth + 1;
								}
								delete temp2;
							}
						}
						delete temp1;
					}
				}
				depth += 1;
				if (cnt[depth] == 0)
					break;
			}
			
			// write tables to file
			fin.close();
			std::ofstream fout;
			fout.open(filename.c_str(), std::ios::out | std::ios::binary);
			for (int i=0; i<2985984; i++) {
				if (!fout.good()) {
					std::cerr << "Something wrong with file phase2.table!\n";
					exit(0);
					break;
				}
				fout.put((char) table[i]);
			}
			fout.close();
		}
		
		return table;
	}
	
	// solve scramble and return movecount
	static int solveScramble(int* t, unsigned char *phase2Table, int upperBound) {
		// compute base values for phase 2 pieces
		int base0 = (48 + t[0] + t[5] + t[7] - 2*t[4] + 2*t[11] - t[13] - t[10])%12;
		int base2 = (48 + t[2] + t[3] + t[7] - 2*t[4] + 2*t[11] - t[13] - t[12])%12;
		int base6 = (48 + t[6] + t[1] + t[5] - 2*t[4] + 2*t[11] - t[9] - t[10])%12;
		int base8 = (48 + t[8] + t[1] + t[3] - 2*t[4] + 2*t[11] - t[9] - t[12])%12;
		int base4 = (36 + t[1] + t[3] + t[5] + t[7] - 3*t[4])%12;
		int base11 = (36 + t[9] + t[10] + t[12] + t[13] - 3*t[11])%12;
			
		// base solution length
		int bestMovecount = 0;
		if (t[1]!=t[4]) bestMovecount++;
		if (t[3]!=t[4]) bestMovecount++;
		if (t[5]!=t[4]) bestMovecount++;
		if (t[7]!=t[4]) bestMovecount++;
		if (t[9]!=t[11]) bestMovecount++;
		if (t[10]!=t[11]) bestMovecount++;
		if (t[12]!=t[11]) bestMovecount++;
		if (t[13]!=t[11]) bestMovecount++;
		bestMovecount += phase2Table[248832*base0 + 20736*base2 + 1728*base6 + 144*base8 + 12*base4 + base11];
			
		// compute phase 1 movecounts for front/back sides
		unsigned char *phase1Front = new unsigned char[20736];
		unsigned char *phase1Back = new unsigned char[20736];
		for (int xUL = 0; xUL < 12; xUL++) {
		for (int xUR = 0; xUR < 12; xUR++) {
		for (int xDL = 0; xDL < 12; xDL++) {
		for (int xDR = 0; xDR < 12; xDR++) {
			// determine number of moves without phase 2
			int frontMovecount = 0;
			if (xUL != 0) frontMovecount++;
			if (xUR != 0) frontMovecount++;
			if (xDL != 0) frontMovecount++;
			if (xDR != 0) frontMovecount++;
			int backMovecount = frontMovecount;
			if ((12 + t[4] + xDL + xDR - t[1])%12 != 0) frontMovecount++;
			if ((12 + t[4] + xUR + xDR - t[3])%12 != 0) frontMovecount++;
			if ((12 + t[4] + xUL + xDL - t[5])%12 != 0) frontMovecount++;
			if ((12 + t[4] + xUL + xUR - t[7])%12 != 0) frontMovecount++;
			phase1Front[1728*xUL + 144*xUR + 12*xDL + xDR] = (unsigned char) frontMovecount;
			if ((12 + t[11] + xDL + xDR - t[9])%12 != 0) backMovecount++;
			if ((12 + t[11] + xUR + xDR - t[10])%12 != 0) backMovecount++;
			if ((12 + t[11] + xUL + xDL - t[12])%12 != 0) backMovecount++;
			if ((12 + t[11] + xUL + xUR - t[13])%12 != 0) backMovecount++;
			phase1Back[1728*xUL + 144*xUR + 12*xDL + xDR] = (unsigned char) backMovecount;
		}}}}
			
		// now try each possible solution
		int curSolution[8] = {0,0,0,0,0,0,0,0}; // fUL, fUR, fDL, fDR, bUL, bUR, bDL, bDR
		for (curSolution[0] = 0; curSolution[0] < 12; curSolution[0]++) {
		for (curSolution[1] = 0; curSolution[1] < 12; curSolution[1]++) {
		for (curSolution[2] = 0; curSolution[2] < 12; curSolution[2]++) {
		for (curSolution[3] = 0; curSolution[3] < 12; curSolution[3]++) {
			int phase1Mid = phase1Front[1728*curSolution[0] + 144*curSolution[1] +12*curSolution[2] + curSolution[3]];
			int mid0 = 36 + base0 - curSolution[0] - curSolution[1] - curSolution[2];
			int mid2 = 36 + base2 - curSolution[0] - curSolution[1] - curSolution[3];
			int mid6 = 36 + base6 - curSolution[0] - curSolution[3] - curSolution[2];
			int mid8 = 36 + base8 - curSolution[3] - curSolution[1] - curSolution[2];
			int new4 = (48 + base4 - curSolution[0] - curSolution[1] - curSolution[3] - curSolution[2])%12;
		for (curSolution[4] = 0; curSolution[4] < 12; curSolution[4]++) {
		for (curSolution[5] = 0; curSolution[5] < 12; curSolution[5]++) {
		for (curSolution[6] = 0; curSolution[6] < 12; curSolution[6]++) {
		for (curSolution[7] = 0; curSolution[7] < 12; curSolution[7]++) {
			// determine number of moves without phase 2
			int curMovecount = phase1Mid + phase1Back[1728*curSolution[4] +
				144*curSolution[5] + 12*curSolution[6] + curSolution[7]];
			if (curMovecount >= bestMovecount) continue;
				
			// determine new values for phase 2 pieces
			int new0 = (mid0 + curSolution[4] + curSolution[5] + curSolution[7])%12;
			int new2 = (mid2 + curSolution[4] + curSolution[5] + curSolution[6])%12;
			int new6 = (mid6 + curSolution[6] + curSolution[5] + curSolution[7])%12;
			int new8 = (mid8 + curSolution[4] + curSolution[6] + curSolution[7])%12;
			int new11 = (48 + base11 - curSolution[4] - curSolution[5] - curSolution[7] - curSolution[6])%12;
				
			// get total solution length
			curMovecount += phase2Table[248832*new0 + 20736*new2 + 1728*new6 + 144*new8 + 12*new4 + new11];
			
			// upper bound
			if(curMovecount <= upperBound) {
				delete[] phase1Front;
				delete[] phase1Back;
				return curMovecount;
			}
				
			// if it's the best so far, store it
			if (curMovecount < bestMovecount) {
				bestMovecount = curMovecount;
			}
		}}}}}}}}
		
		delete[] phase1Front;
		delete[] phase1Back;
		return bestMovecount;
	}

	static int optClockMain() {
		std::mt19937 mt;
		mt.seed(time(NULL));
		std::uniform_int_distribution<int32_t> intDist(0,11);
		
		std::cout << "OptClock (Statistics Version) (c) 2014 by Michael Gottlieb\n";
		
		// moves used in phase 2
		// order: UL UR DL DR front back
		unsigned char phase2Moves[84] =
			{1, 1, 1, 1, 1, 0, // UUUU u = 0
			 1, 1, 1, 0, 1, 0, // UUUD u = 1
			 1, 1, 0, 1, 1, 0, // UUDU u = 2
			 1, 0, 1, 1, 1, 0, // UDUU u = 3
			 1, 0, 0, 1, 1, 0, // UDDU u = 4
			 0, 1, 1, 0, 0, 11, // UDDU d = 5
			 0, 1, 1, 1, 0, 11, // UDDD d = 6
			 0, 1, 1, 1, 1, 0, // DUUU u = 7
			 0, 1, 1, 0, 1, 0, // DUUD u = 8
			 1, 0, 0, 1, 0, 11, // DUUD d = 9
			 1, 0, 1, 1, 0, 11, // DUDD d = 10
			 1, 1, 0, 1, 0, 11, // DDUD d = 11
			 1, 1, 1, 0, 0, 11, // DDDU d = 12
			 1, 1, 1, 1, 0, 11}; // DDDD d = 13
		
		// load phase 2 table
		unsigned char *phase2Table = loadPhase2Table(phase2Moves);
		
		std::cout << "How many random solves?\n";
		int nSolutions = 0;
		std::cin >> nSolutions;
		std::cout << "How many moves to stop searching at? (Enter 0 for optimal solves.)\n";
		int upperBound = 0;
		std::cin >> upperBound;
		
		// get scramble
		int t[14] = {0,0,0,0,0,0,0,0,0,0,0,0,0,0};
		int easyScramble[14] = {0,0,0,0,0,0,0,0,0,0,0,0,0,0};
		int hardScramble[14] = {0,0,0,0,0,0,0,0,0,0,0,0,0,0};
		int easyMovecount = 14;
		int hardMovecount = 0;
		int moveCnt[15] = {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0};
		clock_t start; 
		start = clock();
		for (int nSol = 0; nSol < nSolutions; nSol++) {
			for (int i=0; i<14; i++) {
				t[i] = intDist(mt);
			}
			
			int bestMovecount = solveScramble(t, phase2Table, upperBound);
			moveCnt[bestMovecount]++;
			
			if (nSol % 100 == 0) {
				std::cout << " " << nSol;
				if (nSol % 1000 == 900) {
					std::cout << "\n";
				}
			}
			
			if (bestMovecount < easyMovecount) {
				easyMovecount = bestMovecount;
				for (int i=0; i<14; i++) {
					easyScramble[i] = t[i];
				}
			}
			if (bestMovecount > hardMovecount) {
				hardMovecount = bestMovecount;
				for (int i=0; i<14; i++) {
					hardScramble[i] = t[i];
				}
			}
		}
		std::cout << "\nTook " << (clock() - start) / (double)CLOCKS_PER_SEC << " seconds.\n";
		double sumLength = 0;
		for (int i=0; i<=14; i++) {
			std::cout << i << "\t" << moveCnt[i] << "\n";
			sumLength += i * moveCnt[i];
		}
		std::cout << "Average: " << (sumLength / nSolutions) << "\n";
		std::cout << "Easiest scramble (" << easyMovecount << " moves):\n";
		for (int i=0; i<14; i++) {
			std::cout << " " << easyScramble[i];
		}
		std::cout << "\nHardest scramble (" << hardMovecount << " moves):\n";
		for (int i=0; i<14; i++) {
			std::cout << " " << hardScramble[i];
		}
		std::cout << "\n";
		
		
		return EXIT_SUCCESS;
	}
};

int main(int argc, char *argv[]) {
	optClock::optClockMain();
}