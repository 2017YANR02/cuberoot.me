// Thin ABI over the same OpenCV camera kernels used by cv2. No pose selection,
// altered stopping criteria, or replacement numerical solver lives here.
#include <opencv2/core.hpp>
#include <opencv2/geometry.hpp>
#include <vector>
#include <algorithm>
#include <cmath>

extern "C" int pose_cv(int mode, const double* objects, const double* pixels,
    int count, const double* intrinsic, const double* distortion, int distortion_count,
    const double* guess, double* output, int capacity) {
    try {
        std::vector<cv::Point3f> xyz(count);
        std::vector<cv::Point2f> uv(count);
        for (int i = 0; i < count; ++i) {
            xyz[i] = cv::Point3f(objects[3*i], objects[3*i+1], objects[3*i+2]);
            if (pixels) uv[i] = cv::Point2f(pixels[2*i], pixels[2*i+1]);
        }
        cv::Mat k(3, 3, CV_64F, const_cast<double*>(intrinsic));
        cv::Mat dist(distortion_count, 1, CV_64F, const_cast<double*>(distortion));
        std::vector<cv::Mat> rotations, translations;
        if (mode == 4 || mode == 5) {
            cv::Mat r(3, 1, CV_64F, const_cast<double*>(guess));
            cv::Mat t(3, 1, CV_64F, const_cast<double*>(guess+3));
            if (mode == 5) {
                if (capacity < 2*count) return -2;
                std::vector<cv::Point2f> projected;
                cv::projectPoints(xyz, r, t, k, dist, projected);
                for (int i=0; i<count; ++i) {
                    output[2*i]=projected[i].x; output[2*i+1]=projected[i].y;
                }
                return count;
            }
            r=r.clone(); t=t.clone();
            cv::solvePnPRefineLM(xyz, uv, k, dist, r, t);
            rotations.push_back(r); translations.push_back(t);
        } else if (mode == 2 || mode == 3) {
            cv::solveP3P(xyz, uv, k, dist, rotations, translations,
                mode == 2 ? cv::SOLVEPNP_P3P : cv::SOLVEPNP_AP3P);
        } else {
            cv::solvePnPGeneric(xyz, uv, k, dist, rotations, translations, false,
                mode == 0 ? cv::SOLVEPNP_IPPE : cv::SOLVEPNP_SQPNP);
        }
        if (capacity < 6*static_cast<int>(rotations.size())) return -2;
        for (size_t i=0; i<rotations.size(); ++i)
            for (int j=0; j<3; ++j) {
                output[6*i+j]=rotations[i].at<double>(j);
                output[6*i+j+3]=translations[i].at<double>(j);
            }
        return static_cast<int>(rotations.size());
    } catch (const cv::Exception&) { return -1; }
}
