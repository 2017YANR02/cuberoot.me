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

	// Print the solution given scramble (s[]) and the phase 1 corner moves (cm[])
	static void printSolution(int s[], int cm[], unsigned char phase2Table[], unsigned char phase2Moves[], std::string *moveNames) {
		// phase 1 moves
		for (int i=0; i<4; i++) {
			printMove(moveNames, cm[i], i);
		}
		for (int i=4; i<8; i++) {
			printMove(moveNames, (12 - cm[i]), i);
		}
		printMove(moveNames, 36 - s[4] - cm[2] - cm[3] + s[1], 8);
		printMove(moveNames, 36 - s[4] - cm[1] - cm[3] + s[3], 9);
		printMove(moveNames, 36 - s[4] - cm[0] - cm[2] + s[5], 10);
		printMove(moveNames, 36 - s[4] - cm[0] - cm[1] + s[7], 11);
		printMove(moveNames, 12 + s[11] + cm[6] + cm[7] - s[9], 12);
		printMove(moveNames, 12 + s[11] + cm[5] + cm[7] - s[10], 13);
		printMove(moveNames, 12 + s[11] + cm[4] + cm[6] - s[12], 14);
		printMove(moveNames, 12 + s[11] + cm[4] + cm[5] - s[13], 15);
		
		// phase 2 moves
		// get phase 2 position
		int base0 = (48 + s[0] + s[5] + s[7] - 2*s[4] + 2*s[11] - s[13] - s[10])%12;
		int base2 = (48 + s[2] + s[3] + s[7] - 2*s[4] + 2*s[11] - s[13] - s[12])%12;
		int base6 = (48 + s[6] + s[1] + s[5] - 2*s[4] + 2*s[11] - s[9] - s[10])%12;
		int base8 = (48 + s[8] + s[1] + s[3] - 2*s[4] + 2*s[11] - s[9] - s[12])%12;
		int base4 = (36 + s[1] + s[3] + s[5] + s[7] - 3*s[4])%12;
		int base11 = (36 + s[9] + s[10] + s[12] + s[13] - 3*s[11])%12;
		int new0 = (36 + base0 - cm[0] - cm[1] - cm[2] + cm[4] + cm[5] + cm[7])%12;
		int new2 = (36 + base2 - cm[0] - cm[1] - cm[3] + cm[4] + cm[5] + cm[6])%12;
		int new6 = (36 + base6 - cm[0] - cm[3] - cm[2] + cm[6] + cm[5] + cm[7])%12;
		int new8 = (36 + base8 - cm[3] - cm[1] - cm[2] + cm[4] + cm[6] + cm[7])%12;
		int new4 = (48 + base4 - cm[0] - cm[1] - cm[3] - cm[2])%12;
		int new11 = (48 + base11 - cm[4] - cm[5] - cm[7] - cm[6])%12;
		unsigned char phase2Position[6] = {(unsigned char) new0, (unsigned char) new2, (unsigned char) new6, (unsigned char) new8, (unsigned char) new4, (unsigned char) new11};
		int packed = pack6(phase2Position);
		int phase2Depth = phase2Table[packed];
		
		// find optimal solution to it
		while (phase2Depth > 0) {
			// try each move
			int done = 0;
			for (int move=0; move<14; move++) {
				if (done>0) break;
				for (int amt=1; amt<12; amt++) {
					unsigned char* tempArr = applyMove6(phase2Position, &(phase2Moves[move*6]), amt);
					int packedTemp = pack6(tempArr);
					if (phase2Table[packedTemp] == phase2Depth - 1) {
						printMove(moveNames, amt, 16+move);
						packed = packedTemp;
						for (int i=0; i<6; i++) {
							phase2Position[i] = tempArr[i];
						}
						phase2Depth--;
						done = 1;
						break;
					}
					delete tempArr;
				}
			}
		}
	}

	// print a single move
	static void printMove(std::string *moveNames, int amount, int moveId) {
		amount = amount % 12;
		if (amount==0) {
			return;
		} else if (amount==1) {
			std::cout << " " << moveNames[moveId];
		} else if (amount<=6) {
			std::cout << " " << moveNames[moveId] << amount;
		} else if (amount<=10) {
			std::cout << " " << moveNames[moveId] << (12-amount) << "'";
		} else if (amount==11) {
			std::cout << " " << moveNames[moveId] << "'";
		}
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
	
	// solve scramble and report movecount and stuff
	static int solveScramble(int* t, unsigned char *phase2Table, unsigned char *phase2Moves, std::string *moveNames) {
		// compute base values for phase 2 pieces
		int base0 = (48 + t[0] + t[5] + t[7] - 2*t[4] + 2*t[11] - t[13] - t[10])%12;
		int base2 = (48 + t[2] + t[3] + t[7] - 2*t[4] + 2*t[11] - t[13] - t[12])%12;
		int base6 = (48 + t[6] + t[1] + t[5] - 2*t[4] + 2*t[11] - t[9] - t[10])%12;
		int base8 = (48 + t[8] + t[1] + t[3] - 2*t[4] + 2*t[11] - t[9] - t[12])%12;
		int base4 = (36 + t[1] + t[3] + t[5] + t[7] - 3*t[4])%12;
		int base11 = (36 + t[9] + t[10] + t[12] + t[13] - 3*t[11])%12;
			
		// base solution length
		int bestMovecount = 0;
		int bestSolution[8] = {0,0,0,0,0,0,0,0};
		if (t[1]!=t[4]) bestMovecount++;
		if (t[3]!=t[4]) bestMovecount++;
		if (t[5]!=t[4]) bestMovecount++;
		if (t[7]!=t[4]) bestMovecount++;
		if (t[9]!=t[11]) bestMovecount++;
		if (t[10]!=t[11]) bestMovecount++;
		if (t[12]!=t[11]) bestMovecount++;
		if (t[13]!=t[11]) bestMovecount++;
		int bestPhase1 = bestMovecount;
		bestMovecount += phase2Table[248832*base0 + 20736*base2 + 1728*base6 + 144*base8 + 12*base4 + base11];
		std::cout << "Base solution is length " << bestMovecount << " (" << bestPhase1 << "+" << (bestMovecount-bestPhase1) << ").\n";
			
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
		int checkedCount = 0;
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
			checkedCount++;
				
			// determine new values for phase 2 pieces
			int new0 = (mid0 + curSolution[4] + curSolution[5] + curSolution[7])%12;
			int new2 = (mid2 + curSolution[4] + curSolution[5] + curSolution[6])%12;
			int new6 = (mid6 + curSolution[6] + curSolution[5] + curSolution[7])%12;
			int new8 = (mid8 + curSolution[4] + curSolution[6] + curSolution[7])%12;
			int new11 = (48 + base11 - curSolution[4] - curSolution[5] - curSolution[7] - curSolution[6])%12;
				
			// get total solution length
			curMovecount += phase2Table[248832*new0 + 20736*new2 + 1728*new6 + 144*new8 + 12*new4 + new11];
				
			// if it's the best so far, store it
			if (curMovecount < bestMovecount) {
				int curPhase1 = phase1Mid + phase1Back[1728*curSolution[4] + 144*curSolution[5] + 12*curSolution[6] + curSolution[7]];
				std::cout << "Found solution of length " << curMovecount << " (" << curPhase1 << "+" << (curMovecount-curPhase1) << ")!\n";
				bestMovecount = curMovecount;
				for (int i=0; i<8; i++) {
					bestSolution[i] = curSolution[i];
				}
			}
		}}}}}}}}
			
		std::cout << "Checked " << checkedCount << " solutions.\n";
		std::cout << "" << bestMovecount << " moves is optimal:\n";
		printSolution(t, bestSolution, phase2Table, phase2Moves, moveNames);
			
		// delete stuff from this scramble
		delete[] phase1Front;
		delete[] phase1Back;
	
		return 0;
	}

	static int optClockMain() {
		std::cout << "OptClock (c) 2014 by Michael Gottlieb\n";
		
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
		
		// human-readable move names
		std::string moveNames[30] =
			// phase 1 corners
			{"UDDD u", "DUDD u", "DDUD u", "DDDU u", "UDUU d", "DUUU d", "UUUD d", "UUDU d",
			// phase 1 edges
			"DDUU u", "DUDU u", "UDUD u", "UUDD u", "UUDD d", "DUDU d", "UDUD d", "DDUU d",
			// phase 20n 
			"UUUU u", "UUUD u", "UUDU u", "UDUU u", "UDDU u", "UDDU d", "UDDD d",
			"DUUU u", "DUUD u", "DUUD d", "DUDD d", "DDUD d", "DDDU d", "DDDD d"};
		
		// load phase 2 table
		unsigned char *phase2Table = loadPhase2Table(phase2Moves);
		
		// get scramble
		int t[14] = {0,0,0,0,0,0,0,0,0,0,0,0,0,0};
		while (true) {
			std::cout << "\n";
			int gotScramble = 0;
			while (gotScramble == 0) {
				std::cout << "Enter a scramble, or q to quit:\n";
				std::string input = "";
				getline(std::cin, input);
				if (input == "q") {
					gotScramble = -1;
				} else {
					int numPositions = sscanf(input.c_str(), "%i %i %i %i %i %i %i %i %i %i %i %i %i %i",
						&t[0],&t[1],&t[2],&t[3],&t[4],&t[5],&t[6],&t[7],&t[8],&t[9],&t[10],&t[11],&t[12],&t[13]);
					if (numPositions == 14) {
						gotScramble = 1;
					}
				}
			}
			if (gotScramble == -1) { // quit
				break;
			}
			for (int i=0; i<14; i++) {
				t[i] = t[i] % 12;
				if (t[i] < 0) {
					t[i] = t[i] + 12;
				}
			}
			
			clock_t start; 
			start = clock();
			
			solveScramble(t, phase2Table, phase2Moves, moveNames);
			
			std::cout << "\nOptimal solution found in " << (clock() - start) / (double)CLOCKS_PER_SEC << " seconds.\n";
		}
		
		return EXIT_SUCCESS;
	}
};

int main(int argc, char *argv[]) {
	optClock::optClockMain();
}