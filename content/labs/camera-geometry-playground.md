---
title: 'Camera Geometry Playground: Explore Intrinsics, Pose and Lens Distortion'
slug: camera-geometry-playground-opencv
date: '2026-10-24T09:00:00+02:00'
author: 'Beyond The Joystick'
description: 'Explore how a virtual pinhole camera responds to focal length, optical center, pose and radial lens distortion. An interactive OpenCV playground for understanding camera geometry before calibrating real hardware.'
summary: 'Move 13 sliders to see how intrinsics, pose and radial distortion change an image. This interactive OpenCV playground helps explain camera geometry; it does not estimate calibration parameters from a real camera.'
number: 1
weight: 1
repo: 'https://github.com/sibiliatommaso/camera-geometry-playground'
article: '/rover-camera-calibration-math/'
article_title: 'Rover Camera Calibration: The Mathematics of Space Vision'
stack:
  - Python
  - OpenCV
  - NumPy
image: /images/camera-calibration-lab-examples.png
categories:
  - 'Projects Tutorials'
  - 'Sensors Hardware'
aliases:
  - '/camera-calibration-explained-an-interactive-opencv-lab/'
tags:
  - 'Camera Geometry'
  - 'Pinhole Camera Model'
  - 'Intrinsic Parameters'
  - 'Extrinsic Parameters'
  - 'Radial Distortion'
  - OpenCV
  - 'Computer Vision'
  - Python
---

Camera parameters are easier to understand when you can see what they do. Focal lengths, the optical centre, pose and lens-distortion coefficients often appear in computer-vision code as `K`, `R`, `T` and `distCoeffs`. Reading those values is one thing; building an intuition for how they affect pixels is another.

The **Camera Geometry Playground** is a small interactive OpenCV application for exploring those relationships. It treats an input image as a flat plane in 3D space and renders it through a *virtual pinhole camera*. Move a slider and the output changes immediately, making it easier to understand what each parameter contributes to the projected image.

> **Important distinction:** this is a visualisation and learning tool, not a camera-calibration program. It does not detect a chessboard or calibration target, estimate parameters from a physical camera, minimise reprojection error, or generate a calibration file. Every parameter is supplied manually through the sliders. Use it to understand the model before or alongside a proper real-camera calibration workflow.

If you want the mathematical background first, read [Rover Camera Calibration: The Mathematics of Space Vision](/rover-camera-calibration-mathematics/). That article explains the theory; this playground gives you a hands-on way to explore the visual effects of the parameters.

## What you can explore

The playground exposes 13 interactive parameters in four groups:

- **Translation (`Tx`, `Ty`, `Tz`)** — move the image plane relative to the virtual camera. `Tz` changes the plane depth in the model.
- **Rotation (pitch, yaw and roll)** — change the orientation of the plane.
- **Intrinsics (`fx`, `fy`, `cx`, `cy`)** — change the focal lengths in pixel units and the optical centre.
- **Radial distortion (`k1`, `k2`, `k3`)** — introduce radial bending, including barrel- and pincushion-like effects.

The default settings are chosen so the rendered image matches the input. That gives you a baseline: change one control and observe how the image responds.

{{< figure src="/images/camera-calibration-lab-examples.png" alt="Examples from the Camera Geometry Playground: default projection, a pose change, translation with roll, barrel and pincushion distortion, and changed camera intrinsics" caption="The same input image rendered with different virtual-camera parameters." >}}

## Run it locally in about five minutes

Clone the repository, create a virtual environment and install the dependencies:

```bash
git clone https://github.com/sibiliatommaso/camera-geometry-playground.git
cd camera-geometry-playground

python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

pip install -r requirements.txt
python camera_calibration_lab.py
```

The Python script retains its existing filename, `camera_calibration_lab.py`, for now. The project name describes its purpose more accurately: it is a camera-geometry playground, not a calibration estimator.

By default, the app loads the sample chessboard image included in the repository. To use another image, pass its path:

```bash
python camera_calibration_lab.py path/to/your_image.jpg
```

The app treats the input as a plane, so it is useful for understanding projection and distortion, not for simulating a complete 3D environment.

> **Dependency note:** install `opencv-python`, not `opencv-python-headless`. The headless package does not provide the GUI support needed for the app's windows and sliders.

Two windows open: **Camera Lab - Output** and **Camera Lab - Controls**. Their captions can be renamed in the Python file later; this is not required for the repository rename.

## Controls

With the output window focused:

| Key | Action |
|---|---|
| `r` | Reset the sliders to their default values |
| `s` | Save the current rendered image and print the current `K`, `R`, `T` and `distCoeffs` values |
| `h` | Show or hide the parameter overlay |
| `q` or `Esc` | Quit |

The values printed by `s` are the values currently supplied by the sliders. They are **not measurements estimated from the input image** and should not be presented as calibration results.

## The model behind the sliders

The input image is treated as a plane at a nominal depth `Z₀ = 1`. The intrinsic matrix is built from focal lengths and the optical centre:

{{< mathblock >}}
K = \begin{bmatrix} f_x & 0 & c_x \\ 0 & f_y & c_y \\ 0 & 0 & 1 \end{bmatrix}
{{< /mathblock >}}

The pose of the plane relative to the virtual camera is represented in the model by rotation `R` and translation `T`:

{{< mathblock >}}
\mathbf{X}_c = R\,\mathbf{X} + T
{{< /mathblock >}}

The app then builds a plane-to-image homography from `K`, `R` and `T`, applies the perspective warp with `cv2.warpPerspective`, and applies radial distortion using a remapping grid with `cv2.remap`.

This is a deliberately simplified model designed to make the relationship between parameter values and image pixels visible. It is not a complete physical-camera simulator, and it does not solve for unknown values from observations.

### The parameter groups

| Group | Controls | What changes |
|---|---|---|
| Translation | `Tx`, `Ty`, `Tz` | Position and depth of the flat image plane in the model |
| Rotation | `Pitch X`, `Yaw Y`, `Roll Z` | Orientation of the image plane |
| Intrinsics | `fx`, `fy`, `cx`, `cy` | Pixel focal lengths and optical centre |
| Distortion | `k1`, `k2`, `k3` | Radial distortion strength and shape |

The application models radial distortion only. Tangential coefficients `p1` and `p2` are not interactive parameters in this playground.

## Five experiments to build intuition

### 1. Focal length versus distance

For a front-facing plane, the image scale depends on the ratio between focal length and plane depth. Increase `fx` and `fy`, then move the plane farther away by changing `Tz`. You will see how those changes can produce a similar scale in this simplified frontal case. Tilt the plane and compare again: perspective makes the relationship more complex.

### 2. Optical centre versus translation

Move `cx` and `cy`. The image shifts because the optical centre in the projection model changes. Compare this with `Tx` and `Ty`, which move the plane in the scene model. The visual results can seem similar, but the parameters represent different things.

### 3. Barrel versus pincushion distortion

Sweep `k1` from negative to positive and watch straight lines in the chessboard bend. In the radial model used here, negative `k1` commonly produces barrel distortion, while positive `k1` commonly produces pincushion distortion. Then try `k2` and `k3` to see how higher-order terms affect the image.

### 4. Rotation versus translation

Compare `Yaw` with `Tx`. Rotation changes the plane's orientation; translation moves it relative to the virtual camera. This is a visual introduction to why pose parameters are not interchangeable. Large rotations can move much of the plane outside the output image, which is expected for this planar setup.

### 5. Explore values from a real calibration

If you have already run a separate calibration procedure, you can use some of its output values as examples to explore in the sliders. That can help you build intuition for what the values do visually, but the playground cannot verify the calibration's accuracy or validate its reprojection error.

The app resizes large input images to keep the interface responsive. If the calibration values came from an image at a different resolution, the pixel-based intrinsics (`fx`, `fy`, `cx`, `cy`) need to be scaled consistently before comparison. The playground models radial distortion only, so tangential coefficients are not represented.

## Common problems

- **OpenCV says a GUI function is not implemented.** You may have installed `opencv-python-headless`. Install `opencv-python` instead.
- **The windows do not open on a remote server, WSL or Docker.** The application needs a graphical display; use a local desktop session, X forwarding or WSLg.
- **The sample image cannot be read.** Run the command from the repository root or pass an image path explicitly.
- **The output reports `INVALID POSE` or appears black.** The plane may be behind the camera or close to edge-on. Reduce the rotation or adjust `Tz`.
- **Qt or Wayland errors on Linux.** Try launching with `QT_QPA_PLATFORM=xcb` if appropriate for your environment.

## Limitations

- The scene is a single flat plane, not a full 3D world.
- The model is pinhole-based and includes radial distortion only; it does not model tangential distortion or lens-specific effects beyond these terms.
- The app does not detect calibration patterns, estimate camera parameters, compute reprojection error, or create a calibration file.
- Very large distortion values can take the numerical approximation outside the region where it is geometrically reliable.
- Input images may be resized for responsiveness, so pixel-based values refer to the resized image.

## Frequently asked questions

### Does this tool calibrate my camera?

No. It renders an image through a virtual-camera model using values you choose with the sliders. It does not estimate parameters from camera images.

### What does the intrinsic matrix `K` contain?

In this model, `K` contains focal lengths `fx` and `fy` in pixels and the optical-centre coordinates `cx` and `cy`. Skew is fixed at zero.

### What do `R` and `T` mean here?

They represent the rotation and translation used to position the flat scene plane relative to the virtual camera. The precise frame convention matters in a real robotics pipeline, so do not copy these simplified scene settings directly into a robot's TF tree without checking the coordinate frames.

### What are `k1`, `k2` and `k3`?

They are radial-distortion coefficients in the simplified model. They change how image coordinates bend as distance from the optical centre increases.

### Can I use it before learning OpenCV calibration?

Yes. That is the point: explore the visual effects of the parameter groups, then use a separate real-camera calibration workflow when you need estimated parameters for hardware.

## Source code

The project is open source under the MIT License. You can inspect the Python implementation, adapt it for learning or teaching, and suggest what should be visualised next in the [Camera Geometry Playground repository](https://github.com/sibiliatommaso/camera-geometry-playground).

**Takeaway:** this playground does not calibrate a camera—it helps you understand the geometry and parameters you will encounter when you do.
