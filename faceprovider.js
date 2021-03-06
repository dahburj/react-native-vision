import React, { createContext, Component } from "react";
import { PropTypes } from "prop-types";
import FaceTracker from "./facetracker";
import { RNVisionConsumer } from "./wrapper";
import { RNVRegion } from "./region";
import { calculateRectangles } from "./cameraregion";
import { RNVCameraConsumer, RNVCameraView } from "./view";
const { Provider, Consumer: FacesConsumer } = createContext({ faces: {} });
class FaceInfo extends Component {
  state = {
    faces: {}
  };
  componentDidMount() {
    this.timer = setInterval(() => {
      this.checkOldFaces();
    }, this.props.timeout);
  }
  checkOldFaces() {
    try {
      const keys = Object.entries(this.state.faces)
        .filter(
          ([_, { lastUpdate }]) => lastUpdate < Date.now() - this.props.timeout
        )
        .map(([key]) => key);
      if (keys.length) {
        this.setState(({ faces }) => {
          keys.forEach(k => delete faces[k]);
          return { faces: { ...faces } };
        });
      }
    } catch (e) {}
  }
  componentWillUnmount() {
    if (this.timer) clearInterval(this.timer);
    if (this.faceTimer) clearInterval(this.faceTimer);
  }
  faceTimer = null;
  myFaceInfo = {};
  setFaceInfo(k, info) {
    info.lastUpdate = Date.now();
    this.myFaceInfo[k] = info;
    if (!this.faceTimer)
      this.faceTimer = setTimeout(() => {
        if (this.myFaceInfo) {
          this.setState(
            ({ faces }) => {
              return {
                faces: { ...faces, ...this.myFaceInfo }
              };
            },
            () => {
              this.myFaceInfo = {};
              this.checkOldFaces();
            }
          );
        }
        if (this.faceTimer) clearTimeout(this.faceTimer);
        this.faceTimer = null;
      }, this.props.updateInterval);
  }
  render() {
    return (
      <Provider {...this.props} value={this.state}>
        {this.props.children({ setFaceInfo: this.setFaceInfo.bind(this) })}
      </Provider>
    );
  }
}
const FacesProvider = props => {
  return (
    <FaceTracker {...props}>
      <FaceInfo timeout={props.interval} updateInterval={props.updateInterval}>
        {({ setFaceInfo }) => (
          <RNVisionConsumer>
            {data => {
              if (!data) return null;
              const regions = data.regions;
              return [
                regions
                  ? [
                      ...Object.keys(regions)
                        .filter(k => k.length)
                        .map(k => (
                          <RNVRegion
                            key={"raw-region-" + k}
                            region={k}
                            classifiers={
                              props.classifier && [
                                { url: props.classifier, max: 5 }
                              ]
                            }
                          >
                            {({ classifications }) => {
                              if (typeof classifications == "object") {
                                const fk = Object.keys(classifications).shift();
                                if (!fk) {
                                  setFaceInfo(k, {
                                    region: k,
                                    ...regions[k]
                                  });
                                } else {
                                  const firstClassifier = classifications[fk];
                                  setFaceInfo(k, {
                                    region: k,
                                    ...regions[k],
                                    face: [...firstClassifier].shift().label,
                                    faceConfidence: [...firstClassifier].shift()
                                      .confidence,
                                    faces: firstClassifier
                                  });
                                }
                              } else {
                                setFaceInfo(k, {
                                  region: k,
                                  ...regions[k]
                                });
                              }
                            }}
                          </RNVRegion>
                        ))
                    ]
                  : null,
                typeof props.children == "function" ? (
                  <FacesConsumer>{props.children}</FacesConsumer>
                ) : (
                  props.children
                )
              ];
            }}
          </RNVisionConsumer>
        )}
      </FaceInfo>
    </FaceTracker>
  );
};
FacesProvider.propTypes = {
  ...FaceTracker.propTypes,
  classifier: PropTypes.string,
  updateInterval: PropTypes.number
};
FacesProvider.defaultProps = {
  isCameraFront: true,
  isStarted: true,
  interval: 500,
  updateInterval: 100
};
const Face = props =>
  props.faceID ? (
    <FacesConsumer>
      {({ faces: { [props.faceID]: faceObj } }) =>
        faceObj ? <Face {...faceObj} {...props} faceID={null} /> : null
      }
    </FacesConsumer>
  ) : (
    <RNVCameraConsumer>
      {value =>
        !!value ? (
          <RNVisionConsumer>
            {({ imageDimensions, isCameraFront }) => {
              const newValue = {
                ...props,
                ...value,
                style: calculateRectangles({
                  ...props,
                  ...value,
                  imageDimensions,
                  isCameraFront
                }),
                children: null
              };
              return props.children(newValue);
            }}
          </RNVisionConsumer>
        ) : (
          props.children({ ...props, children: null })
        )
      }
    </RNVCameraConsumer>
  );
Face.propTypes = {
  faceID: PropTypes.string
};
Face.defaultProps = {
  faceID: null
};
const Faces = props => (
  <FacesConsumer>
    {({ faces }) =>
      faces &&
      Object.keys(faces).map(k => (
        <Face faceID={k} key={k}>
          {value => props.children({ key: k, ...value })}
        </Face>
      ))
    }
  </FacesConsumer>
);

Faces.propTypes = {
  children: PropTypes.func.isRequired
};
const FaceCamera = props => (
  <FacesProvider isStarted={true} isCameraFront={false} {...props}>
    <RNVCameraView {...props}>
      {typeof props.children === "function" ? (
        <Faces>{props.children}</Faces>
      ) : (
        props.children
      )}
    </RNVCameraView>
  </FacesProvider>
);
export { FacesProvider, FacesConsumer, Face, Faces, FaceCamera };
