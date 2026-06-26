export interface UnityScript {
  name: string;
  description: string;
  code: string;
}

export const unityScripts: UnityScript[] = [
  {
    name: "CarController.cs",
    description: "Handles realistic arcade-style or physics-based car mechanics using Unity's Wheel Colliders, including motor torque, brake torque, steering, handbrake, drifting, and nitro boosting.",
    code: `using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class CarController : MonoBehaviour
{
    [Header("Wheel Colliders")]
    public WheelCollider frontLeftWheel;
    public WheelCollider frontRightWheel;
    public WheelCollider backLeftWheel;
    public WheelCollider backRightWheel;

    [Header("Wheel Transforms")]
    public Transform frontLeftTransform;
    public Transform frontRightTransform;
    public Transform backLeftTransform;
    public Transform backRightTransform;

    [Header("Car Attributes")]
    public float maxMotorTorque = 1500f;
    public float maxSteeringAngle = 30f;
    public float brakeTorque = 3000f;
    public float handbrakeTorque = 6000f;
    public float maxSpeedKmH = 200f;
    public Rigidbody rb;

    [Header("Nitro Settings")]
    public float nitroMultiplier = 1.8f;
    public float maxNitroDuration = 5f;
    [HideInInspector] public float currentNitroDuration;
    [HideInInspector] public bool isUsingNitro = false;

    [Header("Tire FX & Particles")]
    public TrailRenderer[] skidTrails;
    public ParticleSystem[] exhaustFumes;
    public ParticleSystem[] nitroParticles;

    private float motorInput;
    private float steeringInput;
    private float brakeInput;
    private bool handbrakeActive;
    private float currentSpeed;

    private void Start()
    {
        if (rb == null) rb = GetComponent<Rigidbody>();
        rb.centerOfMass = new Vector3(0, -0.5f, 0); // Lower center of mass to prevent flipping
        currentNitroDuration = maxNitroDuration;
    }

    private void Update()
    {
        GetInputs();
        UpdateWheelVisuals();
        HandleEffects();
    }

    private void FixedUpdate()
    {
        CalculateSpeed();
        HandleMotor();
        HandleSteering();
        HandleBrakes();
    }

    private void GetInputs()
    {
        motorInput = Input.GetAxis("Vertical"); // W / S or Up / Down
        steeringInput = Input.GetAxis("Horizontal"); // A / D or Left / Right
        brakeInput = Input.GetKey(KeyCode.S) && currentSpeed < 0.1f ? 1.0f : 0.0f;
        handbrakeActive = Input.GetKey(KeyCode.Space);

        // Nitro handling
        if (Input.GetKey(KeyCode.LeftShift) && currentNitroDuration > 0 && motorInput > 0)
        {
            isUsingNitro = true;
            currentNitroDuration -= Time.deltaTime;
        }
        else
        {
            isUsingNitro = false;
            if (currentNitroDuration < maxNitroDuration && !Input.GetKey(KeyCode.LeftShift))
            {
                currentNitroDuration += Time.deltaTime * 0.3f; // Recharge slowly
            }
        }
    }

    private void CalculateSpeed()
    {
        // Speed in km/h
        currentSpeed = rb.velocity.magnitude * 3.6f;
    }

    public float GetSpeed()
    {
        return currentSpeed;
    }

    private void HandleMotor()
    {
        // Don't accelerate past max speed unless using nitro
        float topSpeedLimit = isUsingNitro ? maxSpeedKmH * nitroMultiplier : maxSpeedKmH;
        if (currentSpeed >= topSpeedLimit)
        {
            frontLeftWheel.motorTorque = 0;
            frontRightWheel.motorTorque = 0;
            return;
        }

        float currentTorque = motorInput * maxMotorTorque;
        if (isUsingNitro)
        {
            currentTorque *= nitroMultiplier;
        }

        // AWD setup
        frontLeftWheel.motorTorque = currentTorque;
        frontRightWheel.motorTorque = currentTorque;
        backLeftWheel.motorTorque = currentTorque;
        backRightWheel.motorTorque = currentTorque;
    }

    private void HandleSteering()
    {
        // Reduce steering angle at higher speeds for high-speed stability
        float speedFactor = rb.velocity.magnitude / (maxSpeedKmH / 3.6f);
        float currentSteerAngle = Mathf.Lerp(maxSteeringAngle, maxSteeringAngle * 0.35f, speedFactor);
        
        frontLeftWheel.steerAngle = steeringInput * currentSteerAngle;
        frontRightWheel.steerAngle = steeringInput * currentSteerAngle;
    }

    private void HandleBrakes()
    {
        if (handbrakeActive)
        {
            ApplyBrakeTorque(0, 0, handbrakeTorque, handbrakeTorque);
        }
        else if (Input.GetKey(KeyCode.S) && Vector3.Dot(rb.velocity, transform.forward) > 0.1f)
        {
            // Braking while moving forward
            ApplyBrakeTorque(brakeTorque, brakeTorque, brakeTorque, brakeTorque);
        }
        else
        {
            ApplyBrakeTorque(0, 0, 0, 0);
        }
    }

    private void ApplyBrakeTorque(float fl, float fr, float rl, float rr)
    {
        frontLeftWheel.brakeTorque = fl;
        frontRightWheel.brakeTorque = fr;
        backLeftWheel.brakeTorque = rl;
        backRightWheel.brakeTorque = rr;
    }

    private void UpdateWheelVisuals()
    {
        UpdateWheelTransform(frontLeftWheel, frontLeftTransform);
        UpdateWheelTransform(frontRightWheel, frontRightTransform);
        UpdateWheelTransform(backLeftWheel, backLeftTransform);
        UpdateWheelTransform(backRightWheel, backRightTransform);
    }

    private void UpdateWheelTransform(WheelCollider collider, Transform tr)
    {
        Vector3 position;
        Quaternion rotation;
        collider.GetWorldPose(out position, out rotation);
        tr.position = position;
        tr.rotation = rotation;
    }

    private void HandleEffects()
    {
        // Skid trails
        bool isScreeching = handbrakeActive || (Mathf.Abs(steeringInput) > 0.5f && currentSpeed > 50f);
        foreach (var trail in skidTrails)
        {
            if (trail != null) trail.emitting = isScreeching;
        }

        // Exhaust / Smoke particle FX
        foreach (var fume in exhaustFumes)
        {
            if (fume != null)
            {
                var main = fume.main;
                main.startSpeed = Mathf.Lerp(1f, 5f, motorInput);
            }
        }

        // Nitro Flame FX
        foreach (var p in nitroParticles)
        {
            if (p != null)
            {
                if (isUsingNitro && !p.isPlaying) p.Play();
                else if (!isUsingNitro && p.isPlaying) p.Stop();
            }
        }
    }
}`
  },
  {
    name: "AIController.cs",
    description: "Autonomous agent controller that steers, accelerates, and brakes to follow track waypoints, adjusting target speed according to bend angles and avoiding collisions.",
    code: `using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class AIController : MonoBehaviour
{
    [Header("Navigation Waypoints")]
    public Transform pathContainer;
    private List<Transform> waypoints = new List<Transform>();
    private int currentWaypointIndex = 0;

    [Header("AI Parameters")]
    public float maxSpeed = 160f;
    public float maxSteeringAngle = 30f;
    public float sensorLength = 5f;
    public Vector3 frontSensorPosition = new Vector3(0f, 0.2f, 2f);
    public float sidewaySensorShift = 0.8f;
    public float waypointThreshold = 8f;

    [Header("Physics and Wheels")]
    public WheelCollider frontLeftWheel;
    public WheelCollider frontRightWheel;
    public WheelCollider backLeftWheel;
    public WheelCollider backRightWheel;
    public Rigidbody rb;

    private float currentSpeed;
    private bool isAvoiding = false;
    private float targetSteerAngle = 0f;

    private void Start()
    {
        if (rb == null) rb = GetComponent<Rigidbody>();
        rb.centerOfMass = new Vector3(0, -0.5f, 0);
        GetWaypoints();
    }

    private void GetWaypoints()
    {
        if (pathContainer == null) return;
        Transform[] pathTransforms = pathContainer.GetComponentsInChildren<Transform>();
        waypoints = new List<Transform>();

        for (int i = 0; i < pathTransforms.Length; i++)
        {
            if (pathTransforms[i] != pathContainer.transform)
            {
                waypoints.Add(pathTransforms[i]);
            }
        }
    }

    private void FixedUpdate()
    {
        if (waypoints.Count == 0) return;

        currentSpeed = rb.velocity.magnitude * 3.6f;
        Sensors();
        ApplySteering();
        Drive();
        CheckWaypointDistance();
    }

    private void Sensors()
    {
        RaycastHit hit;
        Vector3 sensorStartPos = transform.position;
        sensorStartPos += transform.forward * frontSensorPosition.z;
        sensorStartPos += transform.up * frontSensorPosition.y;
        float avoidMultiplier = 0f;
        isAvoiding = false;

        // Front right sensor
        Vector3 rightSensorPos = sensorStartPos + transform.right * sidewaySensorShift;
        if (Physics.Raycast(rightSensorPos, transform.forward, out hit, sensorLength))
        {
            if (!hit.collider.CompareTag("Track"))
            {
                isAvoiding = true;
                avoidMultiplier -= 1f;
                Debug.DrawLine(rightSensorPos, hit.point, Color.red);
            }
        }

        // Front left sensor
        Vector3 leftSensorPos = sensorStartPos - transform.right * sidewaySensorShift;
        if (Physics.Raycast(leftSensorPos, transform.forward, out hit, sensorLength))
        {
            if (!hit.collider.CompareTag("Track"))
            {
                isAvoiding = true;
                avoidMultiplier += 1f;
                Debug.DrawLine(leftSensorPos, hit.point, Color.red);
            }
        }

        // Front central sensor
        if (Physics.Raycast(sensorStartPos, transform.forward, out hit, sensorLength + 2f))
        {
            if (!hit.collider.CompareTag("Track"))
            {
                isAvoiding = true;
                if (hit.normal.x > 0) avoidMultiplier = 1f;
                else avoidMultiplier = -1f;
                Debug.DrawLine(sensorStartPos, hit.point, Color.red);
            }
        }

        if (isAvoiding)
        {
            targetSteerAngle = maxSteeringAngle * avoidMultiplier;
        }
    }

    private void ApplySteering()
    {
        if (isAvoiding) return;

        Vector3 relativeVector = transform.InverseTransformPoint(waypoints[currentWaypointIndex].position);
        float newSteer = (relativeVector.x / relativeVector.magnitude) * maxSteeringAngle;
        targetSteerAngle = newSteer;

        frontLeftWheel.steerAngle = targetSteerAngle;
        frontRightWheel.steerAngle = targetSteerAngle;
    }

    private void Drive()
    {
        // Automatically brake near sharp turns
        float speedLimit = maxSpeed;
        if (Mathf.Abs(targetSteerAngle) > 15f)
        {
            speedLimit *= 0.5f; // Brake on heavy curves
        }

        if (currentSpeed < speedLimit)
        {
            float motorTorque = 1000f;
            frontLeftWheel.motorTorque = motorTorque;
            frontRightWheel.motorTorque = motorTorque;
            ApplyBrakes(0);
        }
        else
        {
            frontLeftWheel.motorTorque = 0;
            frontRightWheel.motorTorque = 0;
            ApplyBrakes(1500f);
        }
    }

    private void ApplyBrakes(float torque)
    {
        frontLeftWheel.brakeTorque = torque;
        frontRightWheel.brakeTorque = torque;
        backLeftWheel.brakeTorque = torque;
        backRightWheel.brakeTorque = torque;
    }

    private void CheckWaypointDistance()
    {
        if (Vector3.Distance(transform.position, waypoints[currentWaypointIndex].position) < waypointThreshold)
        {
            currentWaypointIndex = (currentWaypointIndex + 1) % waypoints.Count;
        }
    }
}`
  },
  {
    name: "RaceManager.cs",
    description: "Tracks race progress, handles the starting countdown, monitors player and AI checkpoints to prevent cheating, and computes final standing positions.",
    code: `using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;

public class RaceManager : MonoBehaviour
{
    public static RaceManager Instance;

    [Header("Race Config")]
    public int totalLaps = 3;
    public Transform[] checkpoints;
    public GameObject playerCar;
    public GameObject[] aiCars;

    [Header("Race States")]
    public float countdownDuration = 3f;
    private float currentTimer = 0f;
    private bool isRaceActive = false;
    private bool isCountdownActive = true;

    [Header("Events")]
    public UnityEvent<int> onCountdownTick;
    public UnityEvent onRaceStart;
    public UnityEvent onRaceFinished;

    // Track state for each participant
    public class RacerState
    {
        public GameObject carObject;
        public int currentLap = 1;
        public int nextCheckpointIndex = 0;
        public float totalDistanceRaced = 0f;
        public bool hasFinished = false;
        public float completionTime = 0f;
    }

    private List<RacerState> racers = new List<RacerState>();

    private void Awake()
    {
        if (Instance == null) Instance = this;
        else Destroy(gameObject);
    }

    private void Start()
    {
        InitializeRacers();
        StartCoroutine(StartRaceSequence());
    }

    private void InitializeRacers()
    {
        // Add player
        racers.Add(new RacerState { carObject = playerCar });
        // Disable player controls during countdown
        playerCar.GetComponent<CarController>().enabled = false;

        // Add AI
        foreach (var ai in aiCars)
        {
            racers.Add(new RacerState { carObject = ai });
            ai.GetComponent<AIController>().enabled = false;
        }
    }

    private IEnumerator StartRaceSequence()
    {
        float timer = countdownDuration;
        while (timer > 0)
        {
            onCountdownTick?.Invoke(Mathf.CeilToInt(timer));
            yield return new WaitForSeconds(1f);
            timer -= 1f;
        }

        onCountdownTick?.Invoke(0); // Display "GO!"
        isCountdownActive = false;
        isRaceActive = true;
        onRaceStart?.Invoke();

        // Enable controls
        playerCar.GetComponent<CarController>().enabled = true;
        foreach (var ai in aiCars)
        {
            ai.GetComponent<AIController>().enabled = true;
        }

        yield return new WaitForSeconds(1f);
    }

    private void Update()
    {
        if (!isRaceActive) return;
        currentTimer += Time.deltaTime;
        CalculateStandings();
    }

    public void OnPassCheckpoint(GameObject racer, int checkpointIndex)
    {
        RacerState state = racers.Find(r => r.carObject == racer);
        if (state == null || state.hasFinished) return;

        if (checkpointIndex == state.nextCheckpointIndex)
        {
            // Valid checkpoint passed
            state.nextCheckpointIndex = (state.nextCheckpointIndex + 1) % checkpoints.Length;

            // If crossed start line/checkpoint 0 and completed a lap
            if (checkpointIndex == 0)
            {
                if (state.nextCheckpointIndex == 1) // Completed a full lap cycle
                {
                    if (state.currentLap >= totalLaps)
                    {
                        state.hasFinished = true;
                        state.completionTime = currentTimer;
                        CheckRaceEnd();
                    }
                    else
                    {
                        state.currentLap++;
                    }
                }
            }
        }
    }

    private void CalculateStandings()
    {
        // Sort racers based on Lap, nextCheckpointIndex, and distance to that checkpoint
        racers.Sort((a, b) =>
        {
            if (a.hasFinished && b.hasFinished) return a.completionTime.CompareTo(b.completionTime);
            if (a.hasFinished) return -1;
            if (b.hasFinished) return 1;

            if (a.currentLap != b.currentLap) return b.currentLap.CompareTo(a.currentLap);
            if (a.nextCheckpointIndex != b.nextCheckpointIndex) return b.nextCheckpointIndex.CompareTo(a.nextCheckpointIndex);

            // Distance to next checkpoint
            float distA = Vector3.Distance(a.carObject.transform.position, checkpoints[a.nextCheckpointIndex].position);
            float distB = Vector3.Distance(b.carObject.transform.position, checkpoints[b.nextCheckpointIndex].position);
            return distA.CompareTo(distB);
        });
    }

    public int GetPlayerStanding()
    {
        return racers.FindIndex(r => r.carObject == playerCar) + 1;
    }

    public float GetRaceTime()
    {
        return currentTimer;
    }

    public RacerState GetPlayerState()
    {
        return racers.Find(r => r.carObject == playerCar);
    }

    private void CheckRaceEnd()
    {
        RacerState playerState = GetPlayerState();
        if (playerState != null && playerState.hasFinished)
        {
            isRaceActive = false;
            onRaceFinished?.Invoke();
            // Reward system can trigger here
            int standing = GetPlayerStanding();
            SaveSystem.SaveRaceStats(standing, currentTimer);
        }
    }
}`
  },
  {
    name: "CameraController.cs",
    description: "Camera management system that tracks the car smoothly with spring damping, adjusts Field of View dynamically as speed increases, and toggles between multiple camera angles.",
    code: `using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class CameraController : MonoBehaviour
{
    public enum CameraView { ThirdPerson, Hood, Cockpit }
    public CameraView currentView = CameraView.ThirdPerson;

    [Header("Follow Config")]
    public Transform target;
    public float followSpeed = 10f;
    public float rotationSpeed = 5f;

    [Header("Third Person Offsets")]
    public Vector3 thirdPersonOffset = new Vector3(0, 2.8f, -6f);
    
    [Header("Hood Offsets")]
    public Vector3 hoodOffset = new Vector3(0, 1.2f, 1.2f);

    [Header("Cockpit Offsets")]
    public Vector3 cockpitOffset = new Vector3(-0.35f, 0.9f, 0.2f); // Aligned to driver seat

    [Header("Dynamic FOV")]
    public Camera cam;
    public Rigidbody targetRigidbody;
    public float baseFOV = 60f;
    public float maxSpeedFOV = 85f;
    public float maxSpeedForFOV = 180f;

    private void Start()
    {
        if (cam == null) cam = GetComponent<Camera>();
    }

    private void Update()
    {
        // Toggle camera views with V key
        if (Input.GetKeyDown(KeyCode.V))
        {
            CycleCameraView();
        }
    }

    private void FixedUpdate()
    {
        if (target == null) return;

        HandleMovement();
        HandleFOV();
    }

    private void HandleMovement()
    {
        Vector3 targetOffset = Vector3.zero;

        switch (currentView)
        {
            case CameraView.ThirdPerson:
                targetOffset = thirdPersonOffset;
                break;
            case CameraView.Hood:
                targetOffset = hoodOffset;
                break;
            case CameraView.Cockpit:
                targetOffset = cockpitOffset;
                break;
        }

        // Convert offset from local space of the car to global coordinates
        Vector3 targetCamPosition = target.TransformPoint(targetOffset);

        // Smooth position follow
        transform.position = Vector3.Lerp(transform.position, targetCamPosition, followSpeed * Time.fixedDeltaTime);

        // Rotation look-at direction
        Vector3 lookAtDir = target.position + target.forward * 3f - transform.position;
        if (currentView == CameraView.Cockpit || currentView == CameraView.Hood)
        {
            lookAtDir = target.forward;
        }
        
        Quaternion targetRotation = Quaternion.LookRotation(lookAtDir);
        transform.rotation = Quaternion.Slerp(transform.rotation, targetRotation, rotationSpeed * Time.fixedDeltaTime);
    }

    private void HandleFOV()
    {
        if (targetRigidbody == null || cam == null) return;

        float currentSpeedKmH = targetRigidbody.velocity.magnitude * 3.6f;
        float speedRatio = Mathf.Clamp01(currentSpeedKmH / maxSpeedForFOV);
        
        // Dynamically widen camera FOV during speed builds / nitro
        cam.fieldOfView = Mathf.Lerp(baseFOV, maxSpeedFOV, speedRatio);
    }

    public void CycleCameraView()
    {
        int totalViews = System.Enum.GetValues(typeof(CameraView)).Length;
        currentView = (CameraView)(((int)currentView + 1) % totalViews);
    }
}`
  },
  {
    name: "UIManager.cs",
    description: "Updates the in-race HUD dynamically, managing the digital/analog speedometer, lap labels, dynamic positioning, nitro bars, checkpoints alerts, and menus.",
    code: `using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class UIManager : MonoBehaviour
{
    [Header("In-Race HUD Elements")]
    public TMP_Text speedometerText;
    public TMP_Text lapText;
    public TMP_Text positionText;
    public TMP_Text timerText;
    public Image nitroFillBar;
    public TMP_Text countdownText;

    [Header("Screen Panels")]
    public GameObject hudPanel;
    public GameObject pausePanel;
    public GameObject raceOverPanel;

    [Header("End Game Summary")]
    public TMP_Text finalPositionText;
    public TMP_Text finalTimeText;
    public TMP_Text coinsEarnedText;

    private CarController playerCarController;

    private void Start()
    {
        playerCarController = FindObjectOfType<CarController>();
        hudPanel.SetActive(true);
        pausePanel.SetActive(false);
        raceOverPanel.SetActive(false);
    }

    private void Update()
    {
        UpdateHUD();

        if (Input.GetKeyDown(KeyCode.Escape))
        {
            TogglePause();
        }
    }

    private void UpdateHUD()
    {
        if (playerCarController == null) return;

        // Speedometer
        float speed = playerCarController.GetSpeed();
        speedometerText.text = Mathf.RoundToInt(speed).ToString() + " <size=60%>KM/H</size>";

        // Race State
        if (RaceManager.Instance != null)
        {
            var state = RaceManager.Instance.GetPlayerState();
            if (state != null)
            {
                lapText.text = "LAP: " + state.currentLap + " / " + RaceManager.Instance.totalLaps;
            }
            
            positionText.text = GetOrdinalSuffix(RaceManager.Instance.GetPlayerStanding());
            
            // Format timer
            float t = RaceManager.Instance.GetRaceTime();
            int mins = Mathf.FloorToInt(t / 60f);
            int secs = Mathf.FloorToInt(t % 60f);
            int fraction = Mathf.FloorToInt((t * 100f) % 100f);
            timerText.text = string.Format("{0:00}:{1:00}.{2:02}", mins, secs, fraction);
        }

        // Nitro
        float nitroRatio = playerCarController.currentNitroDuration / playerCarController.maxNitroDuration;
        nitroFillBar.fillAmount = nitroRatio;
    }

    public void OnCountdownTick(int count)
    {
        if (count == 0)
        {
            countdownText.text = "GO!";
            StartCoroutine(FadeOutCountdown());
        }
        else
        {
            countdownText.text = count.ToString();
        }
    }

    private IEnumerator FadeOutCountdown()
    {
        yield return new WaitForSeconds(1f);
        countdownText.text = "";
    }

    public void TogglePause()
    {
        bool isPaused = !pausePanel.activeSelf;
        pausePanel.SetActive(isPaused);
        Time.timeScale = isPaused ? 0f : 1f;
    }

    public void OnRaceFinished()
    {
        hudPanel.SetActive(false);
        raceOverPanel.SetActive(true);

        if (RaceManager.Instance != null)
        {
            int placement = RaceManager.Instance.GetPlayerStanding();
            finalPositionText.text = GetOrdinalSuffix(placement) + " PLACE";
            
            float t = RaceManager.Instance.GetRaceTime();
            int mins = Mathf.FloorToInt(t / 60f);
            int secs = Mathf.FloorToInt(t % 60f);
            int fraction = Mathf.FloorToInt((t * 100f) % 100f);
            finalTimeText.text = string.Format("TIME: {0:00}:{1:00}.{2:02}", mins, secs, fraction);

            // Coin Formula: 1st=250, 2nd=150, 3rd=100, others=50
            int reward = 50;
            if (placement == 1) reward = 250;
            else if (placement == 2) reward = 150;
            else if (placement == 3) reward = 100;

            coinsEarnedText.text = "+" + reward + " COINS";
        }
    }

    private string GetOrdinalSuffix(int num)
    {
        if (num <= 0) return "-";
        switch (num % 100)
        {
            case 11:
            case 12:
            case 13:
                return num + "TH";
        }
        switch (num % 10)
        {
            case 1: return num + "ST";
            case 2: return num + "ND";
            case 3: return num + "RD";
            default: return num + "TH";
        }
    }
}`
  },
  {
    name: "AudioManager.cs",
    description: "Synthesizes or manages dynamic vehicle audio pitch adjustments depending on motor torque speeds, play screeching SFX during heavy turns, and controls soundtrack channels.",
    code: `using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class AudioManager : MonoBehaviour
{
    [Header("Audio Sources")]
    public AudioSource engineAudioSource;
    public AudioSource skidAudioSource;
    public AudioSource musicAudioSource;
    public AudioSource collisionAudioSource;

    [Header("Engine Pitch Settings")]
    public float minPitch = 0.8f;
    public float maxPitch = 2.4f;

    [Header("Tire Screech Threshold")]
    public float skidSpeedThreshold = 40f;

    private CarController playerCar;
    private Rigidbody playerRb;

    private void Start()
    {
        playerCar = FindObjectOfType<CarController>();
        if (playerCar != null)
        {
            playerRb = playerCar.GetComponent<Rigidbody>();
        }

        if (engineAudioSource != null && !engineAudioSource.isPlaying) engineAudioSource.Play();
        if (skidAudioSource != null && !skidAudioSource.isPlaying) skidAudioSource.Play();
        skidAudioSource.volume = 0f; // Start silent
    }

    private void Update()
    {
        HandleEngineSound();
        HandleTireScreech();
    }

    private void HandleEngineSound()
    {
        if (playerCar == null || engineAudioSource == null) return;

        float speed = playerCar.GetSpeed();
        // Pitch goes up with car velocity
        float targetPitch = Mathf.Lerp(minPitch, maxPitch, speed / playerCar.maxSpeedKmH);
        
        // Emulate transmission gear shifting
        float gearCycle = (speed % 50f) / 50f;
        targetPitch += (gearCycle * 0.15f);

        engineAudioSource.pitch = Mathf.Lerp(engineAudioSource.pitch, targetPitch, Time.deltaTime * 6f);
    }

    private void HandleTireScreech()
    {
        if (playerCar == null || skidAudioSource == null || playerRb == null) return;

        float speed = playerCar.GetSpeed();
        float slideVal = Vector3.Dot(playerRb.velocity.normalized, playerCar.transform.right);

        // Turn on screech audio when sliding laterally
        if (speed > skidSpeedThreshold && Mathf.Abs(slideVal) > 0.18f)
        {
            skidAudioSource.volume = Mathf.Lerp(skidAudioSource.volume, Mathf.Clamp01(Mathf.Abs(slideVal)), Time.deltaTime * 10f);
        }
        else
        {
            skidAudioSource.volume = Mathf.Lerp(skidAudioSource.volume, 0f, Time.deltaTime * 10f);
        }
    }

    public void PlayCollisionSound(float impactVelocity)
    {
        if (collisionAudioSource != null)
        {
            float volume = Mathf.Clamp01(impactVelocity / 15f);
            collisionAudioSource.PlayOneShot(collisionAudioSource.clip, volume);
        }
    }
}`
  },
  {
    name: "SaveSystem.cs",
    description: "Standardized Unity progression saving utilizing PlayerPrefs for lightweight persistent data: records unlocked garage vehicles, item upgrades, best lap times, and earned coins.",
    code: `using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public static class SaveSystem
{
    private const string COINS_KEY = "PlayerCoins";
    private const string UNLOCKED_CARS_KEY = "UnlockedCars"; // Format: "car1,car2"
    private const string UPGRADE_PREFIX = "Upgrade_"; // Format: Upgrade_car1_engine = lvl

    public static void SaveCoins(int amount)
    {
        PlayerPrefs.SetInt(COINS_KEY, amount);
        PlayerPrefs.Save();
    }

    public static int LoadCoins()
    {
        return PlayerPrefs.GetInt(COINS_KEY, 1000); // Default to 1000 for starting
    }

    public static void UnlockCar(string carId)
    {
        string unlocked = PlayerPrefs.GetString(UNLOCKED_CARS_KEY, "car_rebel");
        if (!unlocked.Contains(carId))
        {
            unlocked += "," + carId;
            PlayerPrefs.SetString(UNLOCKED_CARS_KEY, unlocked);
            PlayerPrefs.Save();
        }
    }

    public static bool IsCarUnlocked(string carId)
    {
        // First car is always unlocked
        if (carId == "car_rebel") return true;

        string unlocked = PlayerPrefs.GetString(UNLOCKED_CARS_KEY, "car_rebel");
        return unlocked.Contains(carId);
    }

    public static void SaveUpgrade(string carId, string upgradeType, int level)
    {
        PlayerPrefs.SetInt(UPGRADE_PREFIX + carId + "_" + upgradeType, level);
        PlayerPrefs.Save();
    }

    public static int GetUpgradeLevel(string carId, string upgradeType)
    {
        return PlayerPrefs.GetInt(UPGRADE_PREFIX + carId + "_" + upgradeType, 1);
    }

    public static void SaveRaceStats(int standing, float time)
    {
        int currentCoins = LoadCoins();
        int reward = 50;
        if (standing == 1) reward = 250;
        else if (standing == 2) reward = 150;
        else if (standing == 3) reward = 100;

        SaveCoins(currentCoins + reward);

        // Record high score / best time
        string activeTrack = PlayerPrefs.GetString("ActiveTrack", "track_city");
        float bestTime = PlayerPrefs.GetFloat("BestTime_" + activeTrack, 9999f);
        if (time < bestTime)
        {
            PlayerPrefs.SetFloat("BestTime_" + activeTrack, time);
            PlayerPrefs.Save();
        }
    }

    public static float GetBestTime(string trackId)
    {
        return PlayerPrefs.GetFloat("BestTime_" + trackId, 0f);
    }

    public static void ClearSaveData()
    {
        PlayerPrefs.DeleteAll();
        PlayerPrefs.Save();
    }
}`
  }
];
