#include <iostream>
#include <cstdlib>
#include <cstring>
#include <cstdio>
#include <sys/time.h>
using namespace std ;
typedef unsigned long long ull ;
const int N = 10 ;
const long long CROSS = (N*N*N*N*N) ;
const long long CORNER = (N*N*N*N) ;
const int CORNERLONG = CORNER/N ;
const long long STATES = (CROSS*CORNER) ;
const long long MEMLONGS = (STATES/N) ;
unsigned char *prune ;
ull *dist ;
unsigned char modN[3*N] ;
char touch[15][9] = {
   {1, 1, 1, 0, 0, 1, 0, 0, 0}, /* 4's */
   {1, 0, 1, 1, 0, 0, 1, 0, 0},
   {0, 1, 1, 0, 1, 0, 0, 1, 0},
   {0, 0, 1, 1, 1, 0, 0, 0, 1},
   {1, 1, 1, 1, 0, 1, 1, 0, 0}, /* 6's */
   {0, 1, 1, 1, 1, 0, 0, 1, 1},
   {1, 1, 1, 0, 1, 1, 0, 1, 0},
   {1, 0, 1, 1, 1, 0, 1, 0, 1},
   {1, 1, 1, 1, 1, 1, 0, 0, 1}, /* 7's */
   {1, 1, 1, 1, 1, 0, 1, 1, 0},
   {1, 1, 1, 1, 1, 1, 1, 1, 0}, /* 8's */
   {1, 1, 1, 1, 1, 1, 1, 0, 1},
   {1, 1, 1, 1, 1, 1, 0, 1, 1},
   {1, 1, 1, 1, 1, 0, 1, 1, 1},
   {1, 1, 1, 1, 1, 1, 1, 1, 1}, /* 9's */
} ;
void error(const char *s) {
   cerr << s << endl ;
   exit(10) ;
}
static double start ;
double walltime() {
   struct timeval tv ;
   gettimeofday(&tv, 0) ;
   return tv.tv_sec + 0.000001 * tv.tv_usec ;
}
double duration() {
   double now = walltime() ;
   double r = now - start ;
   start = now ;
   return r ;
}
long long cnts[100] ;
void unN(long long v, int cnt) {
   if (cnt <= 1)
      cout << v ;
   else {
      unN(v / N, cnt-1) ;
      cout << " " ;
      cout << v % N ;
   }
}
struct clockpos {
   unsigned char p[9] ;
   clockpos() ;
   void move(int m) {
      for (int i=0; i<9; i++)
         p[i] = modN[p[i]+touch[m][i]] ;
   }
   void move(int m, int tw) {
      for (int i=0; i<9; i++)
         p[i] = modN[p[i]+tw*touch[m][i]] ;
   }
   int crossindex() const {
      return p[4] + N * (p[3] + N * (p[2] + N * (p[1] + N * p[0]))) ;
   }
   int cornerindex() const {
      return p[7] + N * (p[6] + N * p[5]) ;
   }
} ;
clockpos solved ;
clockpos::clockpos() {
   *this = solved ;
}
int globald ;
void prunerecur(int togo, const clockpos &cp, int at) {
   if (togo == 0) {
      int ind = cp.crossindex() ;
      if (prune[ind] > globald)
         prune[ind] = globald ;
      return ;
   }
   togo-- ;
   clockpos cp2 = cp ;
   while (at + togo < 9) {
      for (int i=1; i<N; i++) {
         cp2.move(at) ;
         prunerecur(togo, cp2, at+1) ;
      }
      cp2.move(at) ;
      at++ ;
   }
}
void createprune() {
   memset(prune, 5, CROSS) ;
   for (int d=0; d<5; d++) {
      globald = d ;
      prunerecur(d, solved, 0) ;
   }
}
int seen ;
const ull HIBITS = 0x842108421084210LL & ((1LL << (5 * N)) - 1) ;
const ull LOBITS =  HIBITS >> 4 ;
const ull LONGINIT = HIBITS - 2 * LOBITS ; // 14 in each position
void search(const clockpos &cp, int togo, int at) {
   int d = prune[cp.crossindex()] ;
   if (d > togo)
      return ;
   if (togo == 0) {
      int ind = cp.cornerindex() ;
      int off = cp.p[8] * 5 ;
      int val = (dist[ind] >> off) & 15 ;
      if (val > globald) {
         dist[ind] -= ((long long)(val - globald)) << off ;
         seen++ ;
      }
      return ;
   }
   clockpos cp2 = cp ;
   togo-- ;
   while (at + togo < 15) {
      if (at == 8) {
         // don't go past 8 unless cross is nearly solved
         for (int i=1; i<5; i++)
            if (cp2.p[i] != cp2.p[0])
               return ;
      }
      for (int i=1; i<N; i++) {
         cp2.move(at) ;
         search(cp2, togo, at+1) ;
      }
      cp2.move(at) ;
      at++ ;
   }
}
int trans[CORNERLONG] ;
//  Note:  highest value in the array must be 14
//  A 15 will cause an undetected overflow
//  Program must ensure this somehow
void show(ull v) {
   while (v) {
     cout << " " << (v&31) ;
     v >>= 5 ;
   }
   cout << endl ;
}
ull do12(ull v1, ull v2, int tw) {
   v2 = ((v2 << (5 * tw)) | ((v2 >> (5 * (N - tw))))) + LOBITS ;
   ull m = (v2 + HIBITS) - v1 ;
   m = HIBITS - ((HIBITS & ~m) >> 4) ;
   return (v2 & m) | (v1 & ~m) ;
}
void recur(int m, int tw, int at, int src, int dst) {
   if (at == 5) {
      long long src2 = src * CORNERLONG ;
      long long dst2 = dst * CORNERLONG ;
      int add = touch[m][8] * tw ;
      for (int i=0; i<CORNERLONG; i++, src2++) {
         long long dst3 = dst2 + trans[i] ;
         dist[dst3] = do12(dist[dst3], dist[src2], add) ;
      }
      return ;
   }
   int add = touch[m][at] * tw ;
   for (int i=0; i<N; i++)
      recur(m, tw, at+1, N*src+i, N*dst+modN[i+add]) ;
}
void setuptrans(int m, int tw, int at, int src, int dst) {
   if (at == 3) {
      trans[src] = dst ;
   } else {
      int add = touch[m][at+5] * tw ;
      for (int i=0; i<N; i++)
         setuptrans(m, tw, at+1, N*src+i, N*dst+modN[i+add]) ;
   }
}
void gentable() {
   // start with the ones that don't touch the highbits.  This lets
   // us rip through a bunch of positions very fast.
   for (int m=0; m<15; m++) {
      if (touch[m][0])
         continue ;
      cout << "Move " << m << flush ;
      for (int tw=1; tw<N; tw++) {
         setuptrans(m, tw, 0, 0, 0) ;
         recur(m, tw, 1, 0, 0) ;
         cout << " " << tw << flush ;
      }
      cout << endl << flush ;
   }
   int firstfast = 1 ;
   // next the ones that do touch the highbits.  More work here.
   for (int m=0; m<15; m++) {
      if (!touch[m][0])
         continue ;
      cout << "Move " << m << flush ;
      for (int tw=1; tw<N; tw++) {
         setuptrans(m, tw, 0, 0, 0) ;
         if (firstfast)
            recur(m, tw, 1, 0, tw) ;
         else
            recur(m, tw, 0, 0, 0) ;
         cout << " " << tw << flush ;
      }
      cout << endl << flush ;
      firstfast = 0 ;
   }
}
int main(int argc, char *argv[]) {
   duration() ;
   if (argc != 6)
      error("! bad call") ;
   for (int i=0; i<3*N; i++)
      modN[i] = i % N ;
   dist = (ull*)malloc(MEMLONGS*sizeof(ull)) ;
   prune = (unsigned char *)malloc(CROSS) ;
   createprune() ;
   clockpos cp = solved ;
   for (int i=0; i<5; i++)
      cp.p[i] = atol(argv[1+i]) ;
   for (int i=0; i<MEMLONGS; i++)
      dist[i] = LONGINIT ;
   seen = 0 ;
   for (int d=prune[cp.crossindex()]; seen<CORNER && d < 20; d++) {
      cout << "Searching at " << d << endl ;
      globald = d ;
      search(cp, d, 0) ;
      cout << "Saw " << seen << endl ;
   }
   gentable() ;
   for (long long i=0; i<MEMLONGS; i++) {
      ull v = dist[i] ;
      for (int j=0; j<N; j++) {
         cnts[v & 31]++ ;
         v >>= 5 ;
      }
   }
   for (int i=0; i<100; i++)
      if (cnts[i])
         cout << i << ": " << cnts[i] << endl ;
   if (cnts[12] > 0) {
      for (long long i=0; i<MEMLONGS; i++) {
         ull v = dist[i] ;
         for (int j=0; j<N; j++) {
            if ((v & 31) >= 12) {
               ull ii = N * i + j ;
               cout << "Distance 12 position (backwards): cross " ;
               unN(ii/CORNER, 5) ;
               cout << " corners " ;
               unN(ii%CORNER, 4) ;
               cout << " from " << ii ;
               cout << endl ;
            }
            v >>= 5 ;
         }
      }
   }
   cout << "Finished in " << duration() << endl ;
}
